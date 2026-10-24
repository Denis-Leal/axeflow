
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);

    const forwardedHost = ctx.req?.headers['x-forwarded-host'];
    const requestHost = forwardedHost || ctx.req?.headers.host || '';

    const host = requestHost
      .split(',')[0]
      .trim()
      .toLowerCase()
      .split(':')[0];

    const isPortal =
      host === 'portal.axeflow.dbltech.com.br' ||
      host === 'www.portal.axeflow.dbltech.com.br';

    return {
      ...initialProps,
      isPortal,
    };
  }

  render() {
    const { isPortal } = this.props;

    return (
      <Html lang="pt-BR">
        <Head>
          <link
            rel="manifest"
            href={
              isPortal
                ? '/manifest-portal.json'
                : '/manifest.json'
            }
          />

          <meta
            name="application-name"
            content={isPortal ? 'AxeFlow Portal' : 'AxeFlow'}
          />

          <meta
            name="apple-mobile-web-app-title"
            content={isPortal ? 'Portal AxeFlow' : 'AxeFlow'}
          />
        </Head>

        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;