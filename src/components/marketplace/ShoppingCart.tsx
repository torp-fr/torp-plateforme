import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart as CartIcon, Plus, Minus, Trash2, CreditCard } from "lucide-react";
import { CartItem } from "@/types/marketplace";
import { useToast } from "@/components/ui/use-toast";

interface ShoppingCartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ShoppingCart = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  isOpen,
  onToggle
}: ShoppingCartProps) => {
  const { toast } = useToast();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const deliveryCost = totalAmount > 100 ? 0 : 9.90;
  const finalTotal = totalAmount + deliveryCost;

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      onRemoveItem(productId);
      return;
    }
    onUpdateQuantity(productId, newQuantity);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des produits avant de commander",
        variant: "destructive",
      });
      return;
    }
    onCheckout();
    toast({
      title: "Redirection vers le paiement",
      description: `Commande de ${finalTotal.toFixed(2)}€`,
    });
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={onToggle}
          size="lg"
          className="rounded-full shadow-lg relative"
        >
          <CartIcon className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center">
              {totalItems}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onToggle}>
      <div
        className="fixed right-0 top-0 h-full w-96 bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="h-full rounded-none border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CartIcon className="h-5 w-5" />
                Panier ({totalItems})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={onToggle}>
                ✕
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col h-full pb-4">
            <div className="flex-1 overflow-y-auto space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Votre panier est vide</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.product.id} className="border rounded-lg p-3">
                    <div className="flex gap-3">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2">
                          {item.product.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {item.product.supplier.name}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-semibold text-primary">
                            {item.product.price}€
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium min-w-[2ch] text-center">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => onRemoveItem(item.product.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right mt-2">
                      <span className="text-sm font-semibold">
                        Total: {item.totalPrice.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total</span>
                    <span>{totalAmount.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Livraison</span>
                    <span className={deliveryCost === 0 ? "text-green-600" : ""}>
                      {deliveryCost === 0 ? "Gratuite" : `${deliveryCost.toFixed(2)}€`}
                    </span>
                  </div>
                  {deliveryCost === 0 && (
                    <p className="text-xs text-green-600">
                      🎉 Livraison gratuite dès 100€
                    </p>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">{finalTotal.toFixed(2)}€</span>
                  </div>
                </div>

                <Button
                  onClick={handleCheckout}
                  className="w-full"
                  size="lg"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Commander - {finalTotal.toFixed(2)}€
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};