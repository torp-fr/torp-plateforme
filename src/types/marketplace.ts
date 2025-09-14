export interface Supplier {
  id: string;
  name: string;
  logo: string;
  description: string;
  rating: number;
  reviewCount: number;
  specialties: string[];
  deliveryZones: string[];
  minDeliveryAmount: number;
  deliveryTime: string;
  certifications: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  images: string[];
  category: string;
  subcategory: string;
  supplier: Supplier;
  inStock: boolean;
  stockQuantity: number;
  rating: number;
  reviewCount: number;
  specifications: Record<string, string>;
  tags: string[];
  isRecommended?: boolean;
  deliveryTime: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: string;
  estimatedDelivery: string;
  deliveryAddress: string;
  trackingNumber?: string;
  supplier: Supplier;
}

export interface ProductCategory {
  id: string;
  name: string;
  icon: string;
  subcategories: string[];
  productCount: number;
}