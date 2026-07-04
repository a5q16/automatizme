import './globals.css';
import { LanguageProvider } from '@/i18n/context';

export const metadata = {
  title: 'Delivery Portal',
  description: 'Secure automated delivery system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
