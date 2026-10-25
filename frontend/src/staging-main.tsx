import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import StagingApp from './StagingApp';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Không tìm thấy phần tử #root để khởi chạy staging app.');
}

createRoot(rootElement).render(
  <StrictMode>
    <StagingApp />
  </StrictMode>,
);
