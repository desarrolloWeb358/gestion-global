import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from '@mui/material';

import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';

interface MenuItemsProps {
  onNavigate?: () => void;
}

const MenuItems: React.FC<MenuItemsProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: <HomeIcon />, text: 'Inicio', route: '/' },
    { icon: <PersonIcon />, text: 'Usuarios', route: '/usuarios' },
    { icon: <DashboardIcon />, text: 'Dashboard', route: '/dashboard' },
    { icon: <BarChartIcon />, text: 'Reportes', route: '/reportes' },
  ];

  return (
    <List>
      {items.map(({ icon, text, route }) => (
        <ListItemButton
          key={text}
          selected={location.pathname === route}
          onClick={() => {
            navigate(route);
            if (onNavigate) onNavigate(); // cerrar Drawer en móvil
          }}
        >
          <ListItemIcon>{icon}</ListItemIcon>
          <ListItemText primary={text} />
        </ListItemButton>
      ))}
    </List>
  );
};

export default MenuItems;
