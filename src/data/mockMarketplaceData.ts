import { Supplier, Product, ProductCategory, Order } from '@/types/marketplace';

export const mockSuppliers: Supplier[] = [
  {
    id: 'leroy-merlin',
    name: 'Leroy Merlin',
    logo: '/api/placeholder/100/100',
    description: 'Leader français du bricolage et de l\'aménagement de la maison',
    rating: 4.2,
    reviewCount: 15420,
    specialties: ['Matériaux', 'Outillage', 'Décoration', 'Jardin'],
    deliveryZones: ['France métropolitaine', 'Corse'],
    minDeliveryAmount: 39,
    deliveryTime: '2-5 jours',
    certifications: ['ISO 9001', 'FSC', 'PEFC']
  },
  {
    id: 'castorama',
    name: 'Castorama',
    logo: '/api/placeholder/100/100',
    description: 'Magasins de bricolage, décoration et jardinage',
    rating: 4.0,
    reviewCount: 8935,
    specialties: ['Salle de bains', 'Cuisine', 'Carrelage', 'Peinture'],
    deliveryZones: ['France métropolitaine'],
    minDeliveryAmount: 45,
    deliveryTime: '3-7 jours',
    certifications: ['ISO 14001', 'OHSAS 18001']
  },
  {
    id: 'point-p',
    name: 'Point P',
    logo: '/api/placeholder/100/100',
    description: 'Spécialiste des matériaux de construction pour les professionnels',
    rating: 4.5,
    reviewCount: 3240,
    specialties: ['Gros œuvre', 'Second œuvre', 'Isolation', 'Couverture'],
    deliveryZones: ['France métropolitaine', 'DOM-TOM'],
    minDeliveryAmount: 100,
    deliveryTime: '1-3 jours',
    certifications: ['CE', 'NF', 'CSTB']
  },
  {
    id: 'brico-depot',
    name: 'Brico Dépôt',
    logo: '/api/placeholder/100/100',
    description: 'Matériaux de construction à prix discount',
    rating: 3.8,
    reviewCount: 5678,
    specialties: ['Prix discount', 'Matériaux de base', 'Outillage'],
    deliveryZones: ['France métropolitaine'],
    minDeliveryAmount: 50,
    deliveryTime: '2-4 jours',
    certifications: ['CE']
  }
];

export const mockCategories: ProductCategory[] = [
  {
    id: 'materiaux',
    name: 'Matériaux',
    icon: '🧱',
    subcategories: ['Ciment', 'Béton', 'Brique', 'Parpaing', 'Sable', 'Gravier'],
    productCount: 1250
  },
  {
    id: 'outillage',
    name: 'Outillage',
    icon: '🔨',
    subcategories: ['Perceuse', 'Scie', 'Marteau', 'Tournevis', 'Niveau', 'Mètre'],
    productCount: 890
  },
  {
    id: 'plomberie',
    name: 'Plomberie',
    icon: '🚿',
    subcategories: ['Tuyaux', 'Raccords', 'Robinetterie', 'Éviers', 'WC', 'Douche'],
    productCount: 567
  },
  {
    id: 'electricite',
    name: 'Électricité',
    icon: '⚡',
    subcategories: ['Câbles', 'Prises', 'Interrupteurs', 'Tableau électrique', 'Éclairage'],
    productCount: 743
  },
  {
    id: 'isolation',
    name: 'Isolation',
    icon: '🏠',
    subcategories: ['Laine de verre', 'Polystyrène', 'Laine de roche', 'Pare-vapeur'],
    productCount: 321
  },
  {
    id: 'peinture',
    name: 'Peinture',
    icon: '🎨',
    subcategories: ['Peinture murale', 'Peinture bois', 'Vernis', 'Enduit', 'Pinceaux'],
    productCount: 456
  }
];

export const mockProducts: Product[] = [
  {
    id: 'ciment-portland-25kg',
    name: 'Ciment Portland CEM I 42.5 R - 25kg',
    description: 'Ciment haute résistance pour béton et mortier. Conforme à la norme NF EN 197-1.',
    price: 7.95,
    currency: '€',
    images: ['/api/placeholder/300/300', '/api/placeholder/300/300'],
    category: 'materiaux',
    subcategory: 'Ciment',
    supplier: mockSuppliers[2], // Point P
    inStock: true,
    stockQuantity: 450,
    rating: 4.6,
    reviewCount: 89,
    specifications: {
      'Poids': '25 kg',
      'Type': 'CEM I 42.5 R',
      'Résistance': '42.5 MPa',
      'Conditionnement': 'Sac papier'
    },
    tags: ['professionnel', 'résistant', 'norme-nf'],
    isRecommended: true,
    deliveryTime: '1-2 jours'
  },
  {
    id: 'perceuse-bosch-pro',
    name: 'Perceuse visseuse Bosch Professional GSR 18V-21',
    description: 'Perceuse sans fil 18V avec 2 batteries et chargeur. Couple de serrage 55 Nm.',
    price: 189.99,
    originalPrice: 229.99,
    currency: '€',
    images: ['/api/placeholder/300/300', '/api/placeholder/300/300'],
    category: 'outillage',
    subcategory: 'Perceuse',
    supplier: mockSuppliers[0], // Leroy Merlin
    inStock: true,
    stockQuantity: 23,
    rating: 4.8,
    reviewCount: 234,
    specifications: {
      'Tension': '18V',
      'Couple max': '55 Nm',
      'Mandrin': '13 mm',
      'Batteries': '2 x 2.0 Ah incluses'
    },
    tags: ['sans-fil', 'professionnel', 'bosch', 'promo'],
    deliveryTime: '2-3 jours'
  },
  {
    id: 'carrelage-gres-60x60',
    name: 'Carrelage grès cérame 60x60 cm - Effet béton gris',
    description: 'Carrelage moderne effet béton ciré, adapté sol et mur. Classement UPEC.',
    price: 24.90,
    currency: '€/m²',
    images: ['/api/placeholder/300/300', '/api/placeholder/300/300'],
    category: 'revetements',
    subcategory: 'Carrelage',
    supplier: mockSuppliers[1], // Castorama
    inStock: true,
    stockQuantity: 156,
    rating: 4.4,
    reviewCount: 67,
    specifications: {
      'Format': '60 x 60 cm',
      'Épaisseur': '9 mm',
      'Finition': 'Mat',
      'Classement': 'UPEC U4 P3 E3 C2'
    },
    tags: ['tendance', 'effet-beton', 'grand-format'],
    deliveryTime: '3-5 jours'
  },
  {
    id: 'isolation-laine-verre',
    name: 'Isolation laine de verre 200mm - R=5.0',
    description: 'Rouleau laine de verre haute performance thermique. Certifié ACERMI.',
    price: 8.45,
    currency: '€/m²',
    images: ['/api/placeholder/300/300'],
    category: 'isolation',
    subcategory: 'Laine de verre',
    supplier: mockSuppliers[0], // Leroy Merlin
    inStock: true,
    stockQuantity: 89,
    rating: 4.3,
    reviewCount: 156,
    specifications: {
      'Épaisseur': '200 mm',
      'Résistance thermique': 'R = 5.0 m².K/W',
      'Largeur': '1.20 m',
      'Longueur': '4.50 m'
    },
    tags: ['haute-performance', 'acermi', 'thermique'],
    isRecommended: true,
    deliveryTime: '2-4 jours'
  },
  {
    id: 'peinture-facade-10l',
    name: 'Peinture façade acrylique 10L - Blanc',
    description: 'Peinture extérieure haute résistance aux intempéries. Garantie 10 ans.',
    price: 45.90,
    currency: '€',
    images: ['/api/placeholder/300/300'],
    category: 'peinture',
    subcategory: 'Peinture facade',
    supplier: mockSuppliers[3], // Brico Depot
    inStock: true,
    stockQuantity: 67,
    rating: 4.1,
    reviewCount: 43,
    specifications: {
      'Volume': '10 litres',
      'Rendement': '12-14 m²/L',
      'Temps de séchage': '2h (sec au toucher)',
      'Garantie': '10 ans'
    },
    tags: ['exterieur', 'resistant', 'garantie-10ans'],
    deliveryTime: '1-3 jours'
  }
];

export const mockOrders: Order[] = [
  {
    id: 'ORD-2024-001',
    userId: 'user-123',
    items: [
      {
        product: mockProducts[0],
        quantity: 10,
        totalPrice: 79.50
      },
      {
        product: mockProducts[3],
        quantity: 25,
        totalPrice: 211.25
      }
    ],
    totalAmount: 290.75,
    status: 'shipped',
    orderDate: '2024-01-15',
    estimatedDelivery: '2024-01-18',
    deliveryAddress: '123 Rue des Travaux, 31000 Toulouse',
    trackingNumber: 'FR123456789',
    supplier: mockSuppliers[2]
  },
  {
    id: 'ORD-2024-002',
    userId: 'user-123',
    items: [
      {
        product: mockProducts[1],
        quantity: 1,
        totalPrice: 189.99
      }
    ],
    totalAmount: 189.99,
    status: 'delivered',
    orderDate: '2024-01-10',
    estimatedDelivery: '2024-01-13',
    deliveryAddress: '123 Rue des Travaux, 31000 Toulouse',
    supplier: mockSuppliers[0]
  }
];