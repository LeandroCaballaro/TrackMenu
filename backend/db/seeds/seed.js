import { supabase, isSupabaseConfigured } from '../../src/config/supabase.js';
import { initialProducts, initialTables } from '../../src/data/mockData.js';

async function runSeed() {
  console.log('🌱 Iniciando carga de seeds en Supabase...');

  if (!isSupabaseConfigured()) {
    console.error('❌ Error: Supabase no está configurado en backend/.env');
    console.error('Por favor definí SUPABASE_URL y SUPABASE_ANON_KEY antes de ejecutar los seeds.');
    process.exit(1);
  }

  try {
    // 1. Seed Products
    console.log('📦 Insertando productos...');
    const productsData = initialProducts.map(({ id, ...rest }) => rest);
    const { data: prodData, error: prodError } = await supabase
      .from('products')
      .upsert(productsData, { onConflict: 'name' })
      .select();

    if (prodError) {
      console.warn('⚠️ Nota sobre productos:', prodError.message);
    } else {
      console.log(`✅ ${prodData?.length || 0} productos procesados.`);
    }

    // 2. Seed Tables
    console.log('🪑 Insertando mesas...');
    const tablesData = initialTables.map((t) => ({
      number: t.number,
      status: t.status,
      current_order: t.currentOrder,
    }));

    const { data: tblData, error: tblError } = await supabase
      .from('tables')
      .upsert(tablesData, { onConflict: 'number' })
      .select();

    if (tblError) {
      console.warn('⚠️ Nota sobre mesas:', tblError.message);
    } else {
      console.log(`✅ ${tblData?.length || 0} mesas configuradas.`);
    }

    console.log('🎉 Seeds ejecutados con éxito.');
  } catch (err) {
    console.error('❌ Error inesperado durante el seed:', err);
    process.exit(1);
  }
}

runSeed();
