// src/common/ui/InputField.tsx
import { TextField, TextFieldProps } from "@mui/material";

const InputField = (props: TextFieldProps) => {
  return <TextField variant="outlined" fullWidth margin="normal" {...props} />;
};

export default InputField;
