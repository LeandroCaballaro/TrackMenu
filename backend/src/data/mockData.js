const burgerImage = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qw3nfbnetm1rXMnXgRGCZbDkTOypHG.png';

export const initialProducts = [
  {
    id: 1,
    name: 'Burger clásica',
    description: 'Doble smash, cheddar, cebolla caramelizada y salsa de la casa.',
    price: 1890,
    category: 'Hamburguesas',
    image: burgerImage,
  },
  {
    id: 2,
    name: 'Papas a la piedra',
    description: 'Crocantes por fuera, suaves por dentro, con romero y sal de escamas.',
    price: 950,
    category: 'Hamburguesas',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 3,
    name: 'Milanesa de pollo',
    description: 'Rebozada crocante con limón y ensalada fresca.',
    price: 1050,
    category: 'Hamburguesas',
    image: burgerImage,
  },
  {
    id: 4,
    name: 'Limonada casera',
    description: 'Limón natural, menta y un toque de jengibre.',
    price: 780,
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 5,
    name: 'Cheesecake de frutos rojos',
    description: 'Cremoso, suave y con salsa de frutos rojos.',
    price: 1200,
    category: 'Postres',
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=500&q=80',
  },
];

export const initialTables = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  return {
    id: number,
    number,
    status: 'libre',
    currentOrder: null,
  };
});
