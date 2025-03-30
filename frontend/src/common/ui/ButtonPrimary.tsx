// src/common/ui/ButtonPrimary.tsx
import { Button, ButtonProps } from "@mui/material";

const ButtonPrimary = (props: ButtonProps) => {
  return (
    <Button variant="contained" color="primary" {...props}>
      {props.children}
    </Button>
  );
};

export default ButtonPrimary;
