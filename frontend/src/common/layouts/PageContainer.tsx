import { Box, Typography } from "@mui/material";

const PageContainer = ({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) => {
  return (
    <Box>
      {title && (
        <Typography variant="h5" fontWeight="bold" mb={3}>
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
};

export default PageContainer;
