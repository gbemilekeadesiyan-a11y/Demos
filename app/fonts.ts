import { Barlow_Condensed } from 'next/font/google'

// Clarity City (originally requested) isn't on Google Fonts, so isn't
// loadable via next/font/google — Barlow Condensed at Black weight is the
// closest available match for "heavy weight, condensed width" display type.
export const headingFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['900'],
  variable: '--font-heading',
})
