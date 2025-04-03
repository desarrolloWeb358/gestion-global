import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';

const InputField: React.FC<TextFieldProps> = (props) => {
  return <TextField fullWidth margin="normal" {...props} />;
};

export default InputField;
