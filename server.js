require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB Atlas con cifrado TLS/SSL
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado con éxito a MongoDB Atlas (Sora Sweets DB)'))
  .catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// ─────────────────────────────────────────────
// Esquemas de las Colecciones (con validaciones)
// ─────────────────────────────────────────────
const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'El email no tiene un formato válido']
  },
  rol: { type: String, default: 'Cliente' },
  fecha_registro: { type: Date, default: Date.now }
}, { collection: 'usuarios' });

// NOTA: el índice de texto ya existe en Atlas, por eso NO se vuelve a declarar aquí
// (MongoDB solo permite un índice de texto por colección).
const productoSchema = new mongoose.Schema({
  nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
  categoria: { type: String, required: [true, 'La categoría es obligatoria'], trim: true },
  precio: { type: Number, required: [true, 'El precio es obligatorio'], min: [0, 'El precio no puede ser negativo'] },
  stock: { type: Number, default: 0, min: [0, 'El stock no puede ser negativo'] },
  descripcion: String,
  imagen: String,
  // Subdocumento
  detalles: {
    pais_origen: String,
    contenido_gramos: { type: Number, min: [1, 'El contenido debe ser mayor a 0'] },
    es_vegano: Boolean
  },
  // Arreglos
  alergenos: [String],
  etiquetas: [String]
}, { collection: 'productos' });

const ordenSchema = new mongoose.Schema({
  numero_orden: { type: String, default: () => 'ORD-' + Date.now() },
  cliente: { type: String, required: [true, 'El cliente es obligatorio'] },
  producto_nombre: { type: String, required: [true, 'El producto es obligatorio'] },
  cantidad: { type: Number, required: true, min: [1, 'La cantidad mínima es 1'] },
  subtotal: { type: Number, min: 0 },
  envio: { type: Number, min: 0 },
  total: { type: Number, min: 0 },
  estado: { type: String, default: 'Pendiente' },
  fecha: { type: Date, default: Date.now }
}, { collection: 'ordenes' });

const Usuario = mongoose.model('Usuario', usuarioSchema);
const Producto = mongoose.model('Producto', productoSchema);
const Orden = mongoose.model('Orden', ordenSchema);

// ─────────────────────────────────────────────
// PRODUCTOS
// ─────────────────────────────────────────────

// Listar con filtros (subdocumentos, arreglos, texto y rango de precio)
// Ejemplos:
//   /api/productos?pais=Japón&vegano=true
//   /api/productos?q=matcha
//   /api/productos?etiqueta=mochi&max_precio=100
//   /api/productos?sin_alergeno=gluten
//   /api/productos?todos=true   (incluye productos agotados)
app.get('/api/productos', async (req, res) => {
  try {
    const filtro = {};

    if (req.query.todos !== 'true') filtro.stock = { $gt: 0 };
    if (req.query.q) filtro.$text = { $search: req.query.q };
    if (req.query.categoria) filtro.categoria = req.query.categoria;
    if (req.query.pais) filtro['detalles.pais_origen'] = req.query.pais;
    if (req.query.vegano) filtro['detalles.es_vegano'] = req.query.vegano === 'true';
    if (req.query.etiqueta) filtro.etiquetas = req.query.etiqueta;
    if (req.query.sin_alergeno) filtro.alergenos = { $ne: req.query.sin_alergeno };
    if (req.query.max_precio) filtro.precio = { $lte: Number(req.query.max_precio) };

    const productos = await Producto.find(filtro).sort({ categoria: 1, nombre: 1 });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregación: productos por país de origen con precio promedio
app.get('/api/productos/estadisticas/paises', async (req, res) => {
  try {
    const datos = await Producto.aggregate([
      {
        $group: {
          _id: '$detalles.pais_origen',
          total_productos: { $sum: 1 },
          precio_promedio: { $avg: '$precio' }
        }
      },
      { $sort: { total_productos: -1 } }
    ]);
    res.json(datos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregación: cuántos productos tiene cada etiqueta ($unwind sobre el arreglo)
app.get('/api/productos/estadisticas/etiquetas', async (req, res) => {
  try {
    const datos = await Producto.aggregate([
      { $unwind: '$etiquetas' },
      { $group: { _id: '$etiquetas', total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    res.json(datos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un producto por ID
app.get('/api/productos/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear producto
app.post('/api/productos', async (req, res) => {
  try {
    const nuevoProducto = new Producto(req.body);
    await nuevoProducto.save();
    res.status(201).json({
      mensaje: 'Producto agregado con éxito',
      producto: nuevoProducto
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar producto
app.put('/api/productos/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const actualizado = await Producto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!actualizado) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto actualizado con éxito', producto: actualizado });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar producto
app.delete('/api/productos/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const eliminado = await Producto.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado con éxito', id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────
app.post('/api/usuarios', async (req, res) => {
  try {
    const nuevoUsuario = new Usuario(req.body);
    await nuevoUsuario.save();
    res.status(201).json({ mensaje: 'Usuario registrado con éxito', usuario: nuevoUsuario });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// ÓRDENES
// ─────────────────────────────────────────────

// Listar órdenes (opcional: ?cliente=Nombre)
app.get('/api/ordenes', async (req, res) => {
  try {
    const filtro = req.query.cliente ? { cliente: req.query.cliente } : {};
    const ordenes = await Orden.find(filtro).sort({ fecha: -1 });
    res.json(ordenes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear orden: primero descuenta stock de forma atómica y solo después guarda la orden
app.post('/api/ordenes', async (req, res) => {
  try {
    const { producto_nombre, cantidad } = req.body;

    if (!producto_nombre || !Number.isInteger(cantidad) || cantidad < 1) {
      return res.status(400).json({ error: 'producto_nombre y una cantidad entera mayor a 0 son obligatorios' });
    }

    const producto = await Producto.findOneAndUpdate(
      { nombre: producto_nombre, stock: { $gte: cantidad } },
      { $inc: { stock: -cantidad } },
      { new: true }
    );

    if (!producto) {
      return res.status(400).json({ error: 'Producto inexistente o stock insuficiente' });
    }

    try {
      const nuevaOrden = new Orden(req.body);
      await nuevaOrden.save();
      res.status(201).json({ mensaje: 'Orden creada exitosamente', orden: nuevaOrden });
    } catch (errorOrden) {
      // Si la orden no se pudo guardar, se devuelve el stock
      await Producto.updateOne({ _id: producto._id }, { $inc: { stock: cantidad } });
      res.status(400).json({ error: errorOrden.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ticket del cliente: orden + detalle del producto ($lookup)
app.get('/api/ordenes/ticket/:cliente', async (req, res) => {
  try {
    const ticket = await Orden.aggregate([
      { $match: { cliente: req.params.cliente } },
      {
        $lookup: {
          from: 'productos',
          localField: 'producto_nombre',
          foreignField: 'nombre',
          as: 'detalle_producto'
        }
      }
    ]);
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
