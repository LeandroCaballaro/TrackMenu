const users = [
  {
    id: 1,
    email: 'admin@trackmenu.com',
    password: 'admin',
    name: 'Administrador TrackMenu',
    role: 'admin',
  },
];

export const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
  }

  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  }

  const { password: _, ...userWithoutPassword } = user;

  res.json({
    success: true,
    message: 'Inicio de sesión exitoso',
    data: {
      user: userWithoutPassword,
      token: `fake-jwt-token-for-${user.id}`,
    },
  });
};

export const register = (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
  }

  const existing = users.find((u) => u.email === email);
  if (existing) {
    return res.status(409).json({ success: false, message: 'El usuario ya existe' });
  }

  const newUser = {
    id: users.length + 1,
    email,
    password,
    name,
    role: 'cajero',
  };

  users.push(newUser);

  const { password: _, ...userWithoutPassword } = newUser;

  res.status(201).json({
    success: true,
    message: 'Usuario registrado exitosamente',
    data: {
      user: userWithoutPassword,
      token: `fake-jwt-token-for-${newUser.id}`,
    },
  });
};
