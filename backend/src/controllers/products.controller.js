import { initialProducts } from '../data/mockData.js';

let products = [...initialProducts];

export const getProducts = (req, res) => {
  const { category } = req.query;
  if (category) {
    const filtered = products.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
    return res.json({ success: true, count: filtered.length, data: filtered });
  }
  res.json({ success: true, count: products.length, data: products });
};

export const getProductById = (req, res) => {
  const id = Number(req.params.id);
  const product = products.find((p) => p.id === id);

  if (!product) {
    return res.status(404).json({ success: false, message: 'Producto no encontrado' });
  }

  res.json({ success: true, data: product });
};

export const createProduct = (req, res) => {
  const { name, description, price, category, image } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ success: false, message: 'Nombre y precio son requeridos' });
  }

  const newProduct = {
    id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
    name,
    description: description || '',
    price: Number(price),
    category: category || 'Hamburguesas',
    image: image || '',
  };

  products.push(newProduct);
  res.status(201).json({ success: true, data: newProduct });
};
