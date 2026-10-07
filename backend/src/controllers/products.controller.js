import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { initialProducts } from '../data/mockData.js';

let localProducts = [...initialProducts];

export const getProducts = async (req, res, next) => {
  try {
    const { category } = req.query;

    if (isSupabaseConfigured()) {
      let query = supabase.from('products').select('*');
      if (category) {
        query = query.ilike('category', category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.json({ success: true, count: data.length, data });
    }

    // Fallback si aún no configuraron las credenciales de Supabase
    let filtered = localProducts;
    if (category) {
      filtered = filtered.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase()
      );
    }
    res.json({ success: true, count: filtered.length, data: filtered, note: 'Usando datos locales (configurá Supabase en .env)' });
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }
      return res.json({ success: true, data });
    }

    const product = localProducts.find((p) => p.id === id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, category, image } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Nombre y precio son requeridos' });
    }

    const newProduct = {
      name,
      description: description || '',
      price: Number(price),
      category: category || 'Hamburguesas',
      image: image || '',
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('products')
        .insert([newProduct])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, data });
    }

    const created = {
      id: localProducts.length > 0 ? Math.max(...localProducts.map(p => p.id)) + 1 : 1,
      ...newProduct,
    };
    localProducts.push(created);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};
