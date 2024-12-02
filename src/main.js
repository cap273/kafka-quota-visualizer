// src/main.js
import { createApp } from 'vue';
import App from './App.vue';

// Vuetify
import 'vuetify/styles'; // Import Vuetify styles
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

// Optionally, import a Vuetify theme
import '@mdi/font/css/materialdesignicons.css'; // Ensure you are using css-loader

const vuetify = createVuetify({
  components,
  directives,
  // You can customize your theme here
  theme: {
    defaultTheme: 'light',
  },
});

createApp(App)
  .use(vuetify)
  .mount('#app');
