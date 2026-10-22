import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Warframe.market Docs',
  tagline: 'Public API, OAuth, WebSocket, and rules documentation',
  favicon: 'favicon.ico',
  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'mask-icon',
        href: '/safari-pinned-tab.svg',
        color: '#19a187',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'msapplication-config',
        content: '/browserconfig.xml',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'theme-color',
        content: '#101619',
      },
    },
  ],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.warframe.market',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: '42bytes-team',
  projectName: 'docs',

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ko'],
    localeConfigs: {
      en: {
        label: 'English',
      },
      ko: {
        label: '한국어',
      },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en', 'ko'],
        indexDocs: true,
        indexBlog: false,
        highlightSearchTermsOnTargetPage: true,
        removeDefaultStopWordFilter: true,
        removeDefaultStemmer: true,
        fuzzyMatchingDistance: 1,
      },
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/logo.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'WFM Dev Portal',
      logo: {
        alt: 'Warframe.market logo',
        src: 'img/logo-icon.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://warframe.market',
          label: 'Warframe.market',
          position: 'right',
        },
        {
          href: 'https://github.com/42bytes-team',
          label: 'GitHub',
          position: 'right',
          className: 'header-github-link',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/docs/intro',
            },
            {
              label: 'HTTP API',
              to: '/docs/api/overview',
            },
            {
              label: 'WebSockets',
              to: '/docs/websockets/overview',
            },
            {
              label: 'OAuth 2.0',
              to: '/docs/oauth/overview',
            },
            {
              label: 'Data Models',
              to: '/docs/data-models',
            },
            {
              label: 'Rules',
              to: '/docs/rules/overview',
            },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'Warframe.market',
              href: 'https://warframe.market',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/42bytes-team',
              className: 'footer-github-link',
            },
          ],
        },
        {
          title: 'Contributing',
          items: [
            {
              label: 'Guidelines',
              to: '/docs/contributing/documentation-style',
            },
            {
              label: 'Report an Issue',
              href: 'https://github.com/42bytes-team/docs/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Warframe.market. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
