import './jaqaFonts.css'; // JAQA: self-hosted fonts (no Google Fonts requests)
import * as Cesium from 'cesium';

// JAQA: no Cesium logo on the credit line unless Cesium ion content is in use
// (a CESIUM_ION_TOKEN is configured), where ion's attribution applies. Must run
// before the Viewer is created: CreditDisplay copies this setting then.
// Provider attributions (imagery, map data, layers) are unaffected.
if (!String(import.meta.env.CESIUM_ION_TOKEN || '').trim()) {
  Cesium.CreditDisplay.cesiumCredit = undefined;
}
import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().catch((error) => {
  console.error("JAQA Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  loaderStatus.textContent = `Error: ${describeError(error)}`;
  loaderStatus.style.color = '#ff4444';
});

export { application };
