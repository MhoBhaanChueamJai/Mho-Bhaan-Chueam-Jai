import { palette } from '../theme';
import type { Patient } from './mock';

export const statusTone: Record<Patient['status'], { fg: string; bg: string }> = {
  นัดวันนี้: { fg: palette.primary, bg: palette.primarySoft },
  ติดตามอาการ: { fg: '#B0761E', bg: palette.peach },
  หายดี: { fg: palette.green, bg: palette.lime },
  'ส่งต่อ รพ.สต.': { fg: palette.coral, bg: palette.coralSoft },
};
