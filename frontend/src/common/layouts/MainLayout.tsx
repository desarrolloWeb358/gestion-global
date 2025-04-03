import React, { useState, ReactNode } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Drawer,
  CssBaseline,
  Avatar,
  Tooltip,
  Menu,
  MenuItem
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase'; // Ajusta la ruta si es necesario
import MenuItems from '../layouts/MenuItems'; // Ruta del componente lateral
import { useNavigate } from 'react-router-dom';

const drawerWidth = 240;

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorElUser(null);
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => navigate('/login'))
      .catch((error) => console.error('Error al cerrar sesión:', error));
  };

  const drawer = (
    <Box sx={{ mt: 8, p: 2 }}>
      <MenuItems onNavigate={() => setMobileOpen(false)} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* AppBar superior */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
        <IconButton
  color="inherit"
  edge="start"
  onClick={handleDrawerToggle}
  sx={{ mr: 2, display: 'block' }} // solo se muestra en móvil
>
  <MenuIcon />
</IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Gestión Global
          </Typography>
          <Tooltip title="Opciones de usuario">
            <IconButton onClick={handleUserMenuOpen} sx={{ p: 0 }}>
              <Avatar />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorElUser}
            open={Boolean(anchorElUser)}
            onClose={handleUserMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => { handleUserMenuClose(); handleLogout(); }}>
              Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Drawer permanente en pantallas grandes */}
      <Drawer
  variant="persistent"
  anchor="left"
  open={mobileOpen}
  sx={{
    '& .MuiDrawer-paper': {
      width: drawerWidth,
      boxSizing: 'border-box'
    }
  }}
>
  {drawer}
</Drawer>
      {/* Contenido principal */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
