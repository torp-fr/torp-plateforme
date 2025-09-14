import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, Eye, Heart } from "lucide-react";
import { Product } from "@/types/marketplace";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export const ProductCard = ({ product, onViewDetails, onAddToCart }: ProductCardProps) => {
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { toast } = useToast();

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    toast({
      title: "Produit ajouté au panier",
      description: `${quantity}x ${product.name}`,
    });
  };

  const toggleWishlist = () => {
    setIsWishlisted(!isWishlisted);
    toast({
      title: isWishlisted ? "Retiré des favoris" : "Ajouté aux favoris",
      description: product.name,
    });
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 relative">
      {product.isRecommended && (
        <Badge className="absolute top-2 left-2 z-10 bg-gradient-to-r from-primary to-primary/80">
          Recommandé TORP
        </Badge>
      )}
      
      {product.originalPrice && (
        <Badge variant="destructive" className="absolute top-2 right-2 z-10">
          -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
        </Badge>
      )}

      <div className="relative overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <Button
          variant="outline"
          size="icon"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={toggleWishlist}
        >
          <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
        </Button>
      </div>

      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <img
            src={product.supplier.logo}
            alt={product.supplier.name}
            className="w-6 h-6 rounded"
          />
          <span className="text-sm text-muted-foreground">{product.supplier.name}</span>
        </div>

        <h3 className="font-semibold line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {product.description}
        </p>

        <div className="flex items-center gap-1 mb-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < Math.floor(product.rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {product.rating} ({product.reviewCount})
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {product.originalPrice}€
            </span>
          )}
          <span className="text-lg font-bold text-primary">
            {product.price}{product.currency}
          </span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <Badge variant={product.inStock ? "default" : "destructive"}>
            {product.inStock ? `En stock (${product.stockQuantity})` : 'Rupture'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            📦 {product.deliveryTime}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(product)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-1" />
            Détails
          </Button>
          <Button
            size="sm"
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className="flex-1"
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Panier
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};