import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { mockCategories, mockSuppliers } from "@/data/mockMarketplaceData";

interface FilterState {
  categories: string[];
  suppliers: string[];
  priceRange: [number, number];
  inStockOnly: boolean;
  sortBy: string;
  isRecommended: boolean;
}

interface ProductFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onResetFilters: () => void;
}

export const ProductFilters = ({ filters, onFiltersChange, onResetFilters }: ProductFiltersProps) => {
  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleCategory = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(id => id !== categoryId)
      : [...filters.categories, categoryId];
    updateFilter('categories', newCategories);
  };

  const toggleSupplier = (supplierId: string) => {
    const newSuppliers = filters.suppliers.includes(supplierId)
      ? filters.suppliers.filter(id => id !== supplierId)
      : [...filters.suppliers, supplierId];
    updateFilter('suppliers', newSuppliers);
  };

  const activeFiltersCount = 
    filters.categories.length + 
    filters.suppliers.length + 
    (filters.inStockOnly ? 1 : 0) + 
    (filters.isRecommended ? 1 : 0) +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000 ? 1 : 0);

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filtres</CardTitle>
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{activeFiltersCount}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetFilters}
                className="h-8 px-2"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tri */}
        <div>
          <h4 className="font-medium mb-2">Trier par</h4>
          <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Pertinence</SelectItem>
              <SelectItem value="price-asc">Prix croissant</SelectItem>
              <SelectItem value="price-desc">Prix décroissant</SelectItem>
              <SelectItem value="rating">Mieux notés</SelectItem>
              <SelectItem value="delivery">Livraison rapide</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Options rapides */}
        <div>
          <h4 className="font-medium mb-3">Options</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recommended"
                checked={filters.isRecommended}
                onCheckedChange={(checked) => updateFilter('isRecommended', checked)}
              />
              <label htmlFor="recommended" className="text-sm font-medium">
                Recommandés TORP
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="in-stock"
                checked={filters.inStockOnly}
                onCheckedChange={(checked) => updateFilter('inStockOnly', checked)}
              />
              <label htmlFor="in-stock" className="text-sm font-medium">
                En stock uniquement
              </label>
            </div>
          </div>
        </div>

        {/* Prix */}
        <div>
          <h4 className="font-medium mb-3">Prix (€)</h4>
          <div className="px-2">
            <Slider
              value={filters.priceRange}
              onValueChange={(value) => updateFilter('priceRange', value as [number, number])}
              max={1000}
              min={0}
              step={10}
              className="mb-2"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{filters.priceRange[0]}€</span>
              <span>{filters.priceRange[1]}€</span>
            </div>
          </div>
        </div>

        {/* Catégories */}
        <div>
          <h4 className="font-medium mb-3">Catégories</h4>
          <div className="space-y-2">
            {mockCategories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={filters.categories.includes(category.id)}
                  onCheckedChange={() => toggleCategory(category.id)}
                />
                <label
                  htmlFor={`category-${category.id}`}
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  {category.icon} {category.name}
                </label>
                <span className="text-xs text-muted-foreground">
                  {category.productCount}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fournisseurs */}
        <div>
          <h4 className="font-medium mb-3">Fournisseurs</h4>
          <div className="space-y-2">
            {mockSuppliers.map((supplier) => (
              <div key={supplier.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`supplier-${supplier.id}`}
                  checked={filters.suppliers.includes(supplier.id)}
                  onCheckedChange={() => toggleSupplier(supplier.id)}
                />
                <img
                  src={supplier.logo}
                  alt={supplier.name}
                  className="w-4 h-4 rounded"
                />
                <label
                  htmlFor={`supplier-${supplier.id}`}
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  {supplier.name}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs">⭐</span>
                  <span className="text-xs text-muted-foreground">
                    {supplier.rating}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};