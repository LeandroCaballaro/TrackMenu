-- Seed: 001_seed_products.sql
-- Descripción: Carga de productos iniciales en el menú

INSERT INTO public.products (name, description, price, category, image)
VALUES
  (
    'Burger clásica',
    'Doble smash, cheddar, cebolla caramelizada y salsa de la casa.',
    1890.00,
    'Hamburguesas',
    'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qw3nfbnetm1rXMnXgRGCZbDkTOypHG.png'
  ),
  (
    'Papas a la piedra',
    'Crocantes por fuera, suaves por dentro, con romero y sal de escamas.',
    950.00,
    'Hamburguesas',
    'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=80'
  ),
  (
    'Milanesa de pollo',
    'Rebozada crocante con limón y ensalada fresca.',
    1050.00,
    'Hamburguesas',
    'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qw3nfbnetm1rXMnXgRGCZbDkTOypHG.png'
  ),
  (
    'Limonada casera',
    'Limón natural, menta y un toque de jengibre.',
    780.00,
    'Bebidas',
    'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=500&q=80'
  ),
  (
    'Cheesecake de frutos rojos',
    'Cremoso, suave y con salsa de frutos rojos.',
    1200.00,
    'Postres',
    'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=500&q=80'
  );
