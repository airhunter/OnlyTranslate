import DefaultTheme from 'vitepress/theme';
import HomePage from './HomePage.vue';
import UninstallSurvey from './UninstallSurvey.vue';
import UninstallThanks from './UninstallThanks.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage);
    app.component('UninstallSurvey', UninstallSurvey);
    app.component('UninstallThanks', UninstallThanks);
  },
};
