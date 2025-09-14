import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package, TrendingUp, Star } from "lucide-react";
import { mockProducts } from "@/data/mockMarketplaceData";
import { useNavigate } from "react-router-dom";

interface MarketplaceTabProps {
  userType: 'B2C' | 'B2B' | 'B2B2C' | 'B2G';
  projectContext?: {
    analysisResult?: any;
    projectType?: string;
  };
}

export const MarketplaceTab = ({ userType, projectContext }: MarketplaceTabProps) => {
  const navigate = useNavigate();

  // Recommandations basées sur le type d'utilisateur
  const getRecommendedProducts = () => {
    switch (userType) {
      case 'B2C':
        return mockProducts.filter(p => p.price < 100).slice(0, 3);
      case 'B2B':
        return mockProducts.filter(p => p.tags.includes('professionnel')).slice(0, 3);
      case 'B2B2C':
        return mockProducts.filter(p => p.isRecommended).slice(0, 3);
      case 'B2G':
        return mockProducts.filter(p => p.tags.includes('resistant')).slice(0, 3);
      default:
        return mockProducts.slice(0, 3);
    }
  };

  const recommendedProducts = getRecommendedProducts();

  const getContextualMessage = () => {
    switch (userType) {
      case 'B2C':
        return "Matériaux recommandés pour vos travaux personnels";
      case 'B2B':
        return "Fournitures professionnelles adaptées à vos chantiers";
      case 'B2B2C':
        return "Produits certifiés pour vos recommandations clients";
      case 'B2G':
        return "Matériaux conformes aux normes des marchés publics";
      default:
        return "Découvrez notre sélection de produits";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header contextuel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Marketplace TORP
          </CardTitle>
          <p className="text-muted-foreground">{getContextualMessage()}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
              <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="font-semibold">3000+</div>
              <div className="text-sm text-muted-foreground">Produits disponibles</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="font-semibold">15+</div>
              <div className="text-sm text-muted-foreground">Fournisseurs partenaires</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-lg">
              <Star className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
              <div className="font-semibold">4.3/5</div>
              <div className="text-sm text-muted-foreground">Satisfaction clients</div>
            </div>
          </div>
          
          <Button onClick={() => navigate('/marketplace')} size="lg" className="w-full">
            Accéder à la Marketplace
          </Button>
        </CardContent>
      </Card>

      {/* Recommandations contextuelles */}
      <Card>
        <CardHeader>
          <CardTitle>Recommandations TORP</CardTitle>
          <p className="text-sm text-muted-foreground">
            Basées sur {projectContext ? 'votre projet' : 'votre profil'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendedProducts.map((product) => (
              <Card key={product.id} className="group hover:shadow-md transition-shadow">
                <div className="relative">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-32 object-cover rounded-t-lg"
                  />
                  {product.isRecommended && (
                    <Badge className="absolute top-2 left-2 text-xs">
                      TORP
                    </Badge>
                  )}
                </div>
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm line-clamp-2 mb-2">
                    {product.name}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">{product.price}€</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs">{product.rating}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {product.supplier.name}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/marketplace')}
            >
              Voir tous les produits recommandés
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Avantages spécifiques */}
      <Card>
        <CardHeader>
          <CardTitle>Avantages Marketplace TORP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                ✅
              </div>
              <div>
                <h4 className="font-medium">Produits certifiés</h4>
                <p className="text-sm text-muted-foreground">
                  Tous les produits sont validés par nos experts
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                🚚
              </div>
              <div>
                <h4 className="font-medium">Livraison gratuite</h4>
                <p className="text-sm text-muted-foreground">
                  Dès 100€ d'achat chez nos partenaires
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                💰
              </div>
              <div>
                <h4 className="font-medium">Prix négociés</h4>
                <p className="text-sm text-muted-foreground">
                  Tarifs préférentiels TORP exclusifs
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                🔄
              </div>
              <div>
                <h4 className="font-medium">Suivi intégré</h4>
                <p className="text-sm text-muted-foreground">
                  Commandes liées à vos projets TORP
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};