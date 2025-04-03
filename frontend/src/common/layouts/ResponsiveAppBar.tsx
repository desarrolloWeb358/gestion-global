import {
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Avatar,
    Tooltip,
    Menu,
    MenuItem,
    Box,
  } from "@mui/material";
  import MenuIcon from "@mui/icons-material/Menu";
  import { useState } from "react";
  
  const ResponsiveAppBar = () => {
    const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  
    const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
      setAnchorElUser(event.currentTarget);
    };
  
    const handleUserMenuClose = () => {
      setAnchorElUser(null);
    };
  
    return (
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Gestión Global
          </Typography>
          <Tooltip title="Opciones de usuario">
            <IconButton onClick={handleUserMenuOpen}>
              <Avatar />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorElUser}
            open={Boolean(anchorElUser)}
            onClose={handleUserMenuClose}
          >
            <MenuItem onClick={handleUserMenuClose}>Cerrar sesión</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
    );
  };
  
  export default ResponsiveAppBar;  