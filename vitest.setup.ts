import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Hermético: una VE_VIDEOS_DIR (o VE_ASSETS) exportada en la terminal de quien corre las pruebas cambia qué videos y qué
// carpetas ve el runtime; las pruebas que la necesitan la fijan ellas mismas (ver `withTempVideos`).
delete process.env.VE_VIDEOS_DIR;
delete process.env.VE_ASSETS;
delete process.env.VE_ALLOW_MISSING_FONTS;

afterEach(() => cleanup());
