import './globals.css'

export const metadata = {
  title: 'Аквариум — видеозвонки',
  description: 'Видеозвонки по ссылке с аквариумом за спиной и озвучкой текста',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
