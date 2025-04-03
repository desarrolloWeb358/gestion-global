import React from 'react';
import { Typography, TypographyProps } from '@mui/material';

const SectionTitle: React.FC<TypographyProps> = (props) => {
  return (
    <Typography variant="h5" fontWeight={600} gutterBottom {...props} />
  );
};

export default SectionTitle;
