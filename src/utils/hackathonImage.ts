import hackathonDetailDefaultImage from '../assets/hackathon_detail_default.png'

// Static imports for hackathon images
import hack2 from '../assets/hackathons_image/hack-2.jpg'
import hack2_1 from '../assets/hackathons_image/hack-2-1.jpg'
import hack3 from '../assets/hackathons_image/hack-3.jpg'
import hack3_1 from '../assets/hackathons_image/hack-3-1.jpg'
import hack3_2 from '../assets/hackathons_image/hack-3-2.jpg'
import hack4 from '../assets/hackathons_image/hack-4.jpg'
import hack4_1 from '../assets/hackathons_image/hack-4-1.jpg'
import hack4_2 from '../assets/hackathons_image/hack-4-2.jpg'
import hack5_1 from '../assets/hackathons_image/hack-5-1.jpg'
import hack5_2 from '../assets/hackathons_image/hack-5-2.jpg'
import hack6 from '../assets/hackathons_image/hack-6.jpg'
import hack6_1 from '../assets/hackathons_image/hack-6-1.jpg'
import hack6_2 from '../assets/hackathons_image/hack-6-2.jpg'
import hack7 from '../assets/hackathons_image/hack-7.jpg'
import hack7_1 from '../assets/hackathons_image/hack-7-1.jpg'
import hack8 from '../assets/hackathons_image/hack-8.jpg'
import hack9 from '../assets/hackathons_image/hack-9.jpg'
import hack9_1 from '../assets/hackathons_image/hack-9-1.jpg'
import hack10 from '../assets/hackathons_image/hack-10.jpg'
import hack10_1 from '../assets/hackathons_image/hack-10-1.jpg'
import hack11 from '../assets/hackathons_image/hack-11.jpg'
import hack13 from '../assets/hackathons_image/hack-13.jpg'
import hack14 from '../assets/hackathons_image/hack-14.jpg'
import hack15 from '../assets/hackathons_image/hack-15.jpg'

const hackathonImageMap: Record<string, string> = {
  'hack-2': hack2,
  'hack-2-1': hack2_1,
  'hack-3': hack3,
  'hack-3-1': hack3_1,
  'hack-3-2': hack3_2,
  'hack-4': hack4,
  'hack-4-1': hack4_1,
  'hack-4-2': hack4_2,
  'hack-5-1': hack5_1,
  'hack-5-2': hack5_2,
  'hack-6': hack6,
  'hack-6-1': hack6_1,
  'hack-6-2': hack6_2,
  'hack-7': hack7,
  'hack-7-1': hack7_1,
  'hack-8': hack8,
  'hack-9': hack9,
  'hack-9-1': hack9_1,
  'hack-10': hack10,
  'hack-10-1': hack10_1,
  'hack-11': hack11,
  'hack-13': hack13,
  'hack-14': hack14,
  'hack-15': hack15,
}

export function getHackathonImage(slug: string): string {
  return hackathonImageMap[slug] || hackathonDetailDefaultImage
}

export { hackathonDetailDefaultImage }
