import { Navigate } from 'react-router-dom';

const Index = () => {
  // This page is no longer used, as routing is handled in App.tsx
  return <Navigate to="/login" replace />;
};

export default Index;
