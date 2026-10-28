// Supabase devuelve como máximo 1,000 filas por consulta. Para tablas que crecen
// (historial de estatus, facturas, etc.) hay que leer por páginas.
// Uso: const { data, error } = await leerTodo((desde, hasta) => supabase.from("t").select("...").range(desde, hasta));
export async function leerTodo(consulta, tamPagina = 1000) {
  let todo = [];
  for (let desde = 0; ; desde += tamPagina) {
    const { data, error } = await consulta(desde, desde + tamPagina - 1);
    if (error) return { data: todo, error };
    todo = todo.concat(data || []);
    if (!data || data.length < tamPagina) return { data: todo, error: null };
  }
}
