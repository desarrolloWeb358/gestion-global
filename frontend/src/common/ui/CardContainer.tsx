import React from 'react';
import { Paper, Box, PaperProps } from '@mui/material';

const CardContainer: React.FC<PaperProps> = ({ children, ...props }) => {
  return (
    <Paper elevation={3} {...props}>
      <Box p={3}>{children}</Box>
    </Paper>
  );
};

export default CardContainer;
