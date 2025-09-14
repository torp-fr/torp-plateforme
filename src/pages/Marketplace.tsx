import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, Grid, List, ShoppingCart as CartIcon } from "lucide-react";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { ProductFilters } from "@/components/marketplace/ProductFilters";
import { ShoppingCart } from "@/components/marketplace/ShoppingCart";
import { mockProducts, mockCategories, mockSuppliers } from "@/data/mockMarketplaceData";
import { Product, CartItem } from "@/types/marketplace";
import { useToast } from "@/components/ui/use-toast";

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    categories: [] as string[],
    suppliers: [] as string[],
    priceRange: [0, 1000] as [number, number],
    inStockOnly: false,
    sortBy: "relevance",
    isRecommended: false
  });

  const filteredProducts = useMemo(() => {
    let products = mockProducts.filter(product => {
      // Recherche textuelle
      if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Filtres catégories
      if (filters.categories.length > 0 && !filters.categories.includes(product.category)) {
        return false;
      }

      // Filtres fournisseurs
      if (filters.suppliers.length > 0 && !filters.suppliers.includes(product.supplier.id)) {
        return false;
      }

      // Filtre prix
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) {
        return false;
      }

      // Filtre stock
      if (filters.inStockOnly && !product.inStock) {
        return false;
      }

      // Filtre recommandés
      if (filters.isRecommended && !product.isRecommended) {
        return false;
      }

      return true;
    });

    // Tri
    switch (filters.sortBy) {
      case "price-asc":
        products.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        products.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        products.sort((a, b) => b.rating - a.rating);
        break;
      case "delivery":
        products.sort((a, b) => a.deliveryTime.localeCompare(b.deliveryTime));
        break;
      default:
        // Tri par pertinence (recommandés en premier)
        products.sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0));
    }

    return products;
  }, [searchQuery, filters]);

  const handleViewProduct = (product: Product) => {
    toast({
      title: "Détail produit",
      description: `Affichage de ${product.name}`,
    });
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    const existingItem = cartItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      setCartItems(items =>
        items.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity, totalPrice: (item.quantity + quantity) * product.price }
            : item
        )
      );
    } else {
      const newItem: CartItem = {
        product,
        quantity,
        totalPrice: quantity * product.price
      };
      setCartItems(items => [...items, newItem]);
    }
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    setCartItems(items =>
      items.map(item =>
        item.product.id === productId
          ? { ...item, quantity, totalPrice: quantity * item.product.price }
          : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCartItems(items => items.filter(item => item.product.id !== productId));
  };

  const handleCheckout = () => {
    // Logique de commande
    console.log("Checkout with items:", cartItems);
  };

  const resetFilters = () => {
    setFilters({
      categories: [],
      suppliers: [],
      priceRange: [0, 1000],
      inStockOnly: false,
      sortBy: "relevance",
      isRecommended: false
    });
  };

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Marketplace TORP</h1>
              <p className="text-muted-foreground">Matériaux et fournitures pour vos projets</p>
            </div>
            <Button
              onClick={() => setShowCart(true)}
              variant="outline"
              className="relative"
            >
              <CartIcon className="h-4 w-4 mr-2" />
              Panier
              {totalCartItems > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {totalCartItems}
                </Badge>
              )}
            </Button>
          </div>

          {/* Barre de recherche et contrôles */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher des produits, matériaux..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-primary text-primary-foreground" : ""}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtres
            </Button>

            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Catégories rapides */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {mockCategories.map((category) => (
              <Badge
                key={category.id}
                variant={filters.categories.includes(category.id) ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => {
                  const newCategories = filters.categories.includes(category.id)
                    ? filters.categories.filter(id => id !== category.id)
                    : [...filters.categories, category.id];
                  setFilters({ ...filters, categories: newCategories });
                }}
              >
                {category.icon} {category.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="container py-6">
        <div className="flex gap-6">
          {/* Filtres latéraux */}
          {showFilters && (
            <div className="w-80 flex-shrink-0">
              <ProductFilters
                filters={filters}
                onFiltersChange={setFilters}
                onResetFilters={resetFilters}
              />
            </div>
          )}

          {/* Zone principale */}
          <div className="flex-1">
            {/* Statistiques */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
                {searchQuery && ` pour "${searchQuery}"`}
              </p>
              
              {/* Fournisseurs populaires */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Fournisseurs :</span>
                {mockSuppliers.slice(0, 3).map((supplier) => (
                  <img
                    key={supplier.id}
                    src={supplier.logo}
                    alt={supplier.name}
                    className="w-8 h-8 rounded border"
                    title={supplier.name}
                  />
                ))}
                <span className="text-sm text-muted-foreground">+{mockSuppliers.length - 3}</span>
              </div>
            </div>

            {/* Grille de produits */}
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onViewDetails={handleViewProduct}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="p-4">
                    <CardContent className="flex gap-4 p-0">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-24 h-24 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-lg font-bold text-primary">
                            {product.price}€
                          </span>
                          <Button onClick={() => handleAddToCart(product, 1)}>
                            Ajouter au panier
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">Aucun produit trouvé</h3>
                <p className="text-muted-foreground mb-4">
                  Essayez de modifier vos critères de recherche
                </p>
                <Button onClick={resetFilters} variant="outline">
                  Réinitialiser les filtres
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panier */}
      <ShoppingCart
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleCheckout}
        isOpen={showCart}
        onToggle={() => setShowCart(!showCart)}
      />
    </div>
  );
}