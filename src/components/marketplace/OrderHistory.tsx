import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Truck, CheckCircle, XCircle, Eye } from "lucide-react";
import { Order } from "@/types/marketplace";
import { useState } from "react";

interface OrderHistoryProps {
  orders: Order[];
}

export const OrderHistory = ({ orders }: OrderHistoryProps) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Package className="h-4 w-4 text-yellow-500" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'preparing':
        return <Package className="h-4 w-4 text-orange-500" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-purple-500" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: Order['status']) => {
    const labels = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      preparing: 'Préparation',
      shipped: 'Expédiée',
      delivered: 'Livrée',
      cancelled: 'Annulée'
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: Order['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'delivered':
        return 'default';
      case 'cancelled':
        return 'destructive';
      case 'shipped':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Historique des commandes</h3>
        <Badge variant="outline">
          {orders.length} commande{orders.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Aucune commande pour le moment</p>
            <p className="text-sm text-muted-foreground mt-2">
              Vos commandes marketplace apparaîtront ici
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(order.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{order.id}</span>
                        <Badge variant={getStatusVariant(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.supplier.name} • {order.orderDate}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">
                        {order.totalAmount.toFixed(2)}€
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.items.length} article{order.items.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Détails
                    </Button>
                  </div>
                </div>

                {order.status === 'shipped' && order.trackingNumber && (
                  <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Suivi de livraison</span>
                      <span className="text-sm font-mono">{order.trackingNumber}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Livraison prévue le {order.estimatedDelivery}
                    </div>
                  </div>
                )}

                {order.status === 'delivered' && (
                  <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Commande livrée avec succès</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal détails commande */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Détails de la commande {selectedOrder.id}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOrder(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Informations commande</h4>
                  <div className="space-y-1 text-sm">
                    <div>Date: {selectedOrder.orderDate}</div>
                    <div>Statut: {getStatusLabel(selectedOrder.status)}</div>
                    <div>Fournisseur: {selectedOrder.supplier.name}</div>
                    {selectedOrder.trackingNumber && (
                      <div>Suivi: {selectedOrder.trackingNumber}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Livraison</h4>
                  <div className="space-y-1 text-sm">
                    <div>Prévue le: {selectedOrder.estimatedDelivery}</div>
                    <div className="break-words">{selectedOrder.deliveryAddress}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Articles commandés</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 border rounded">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.quantity} × {item.product.price}€
                        </div>
                      </div>
                      <div className="font-semibold">
                        {item.totalPrice.toFixed(2)}€
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center font-semibold">
                  <span>Total commande</span>
                  <span className="text-lg">{selectedOrder.totalAmount.toFixed(2)}€</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};