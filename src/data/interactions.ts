/**
 * อันตรกิริยาระหว่างสมุนไพรกับยาแผนปัจจุบัน (herb–drug interactions)
 * ถอดจากหัวข้อ "อันตรกิริยา" / "ข้อควรระวัง" ใน ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566 (ภาคผนวก 2)
 * ราชกิจจานุเบกษา เล่ม ๑๔๐ ตอนพิเศษ ๑๓๐ ง หน้า ๔๕, ๒ มิถุนายน ๒๕๖๖ · https://herbal.fda.moph.go.th/media.php?id=511902077832798208&name=001-66.pdf
 * ข้อความเป็นของผลิตภัณฑ์ในบัญชียาหลัก (ไม่ใช่สมุนไพรสดทุกรูปแบบ) · ประกาศไม่ได้ระบุระดับความรุนแรง
 * ข้อของพริกไทย/ดีปลีมาจากตำรับที่ระบุว่ามีพริกไทยหรือดีปลีในปริมาณสูง · ห้ามเติมข้อมูลที่ไม่มีในประกาศ
 */
export type DrugClass = 'blood' | 'cancer' | 'bp' | 'liver_diuretic_sedative' | 'dm_lipid' | 'dm' | 'chronic' | 'pepper' | 'cyp';
export type HerbDrug = { herb: string; drug: DrugClass; label: string; statement: string; products: string[]; pages: number[]; formula?: boolean };

export const INTERACTION_SOURCE = { title: "ประกาศคณะกรรมการพัฒนาระบบยาแห่งชาติ เรื่อง บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566 (ภาคผนวก 2)", gazette: "ราชกิจจานุเบกษา เล่ม ๑๔๐ ตอนพิเศษ ๑๓๐ ง หน้า ๔๕, ๒ มิถุนายน ๒๕๖๖", url: "https://herbal.fda.moph.go.th/media.php?id=511902077832798208&name=001-66.pdf" };

/** คำในรายการยาของผู้ป่วยที่บอกว่าเข้ากลุ่มยานี้ (ใช้จับคู่อัตโนมัติ — ไม่ครบทุกยี่ห้อ ให้ผู้ใช้เลือกกลุ่มยาเองได้ด้วย) */
export const DRUG_MATCH: Record<DrugClass, RegExp | null> = {
  blood: /วาร์ฟาริน|warfarin|แอสไพริน|aspirin|asa\b|โคลพิโดเกรล|clopidogrel|ticagrelor|cilostazol|apixaban|rivaroxaban|dabigatran|edoxaban|ยาละลายลิ่มเลือด|ยาต้านเกล็ด|ยากันเลือดแข็ง|ยาต้านการแข็งตัว/i,
  cancer: /doxorubicin|cyclophosphamide|chlormethine|camptothecin|เคมีบำบัด|ยามะเร็ง|ยารักษามะเร็ง/i,
  bp: /ยาลดความดัน|amlodipine|แอมโลดิปีน|enalapril|อีนาลาพริล|losartan|โลซาร์แทน|atenolol|อะทีโนลอล|hydrochlorothiazide|hctz|ไฮโดรคลอโรไทอะไซด์|nifedipine|manidipine|propranolol/i,
  liver_diuretic_sedative: /ยาขับปัสสาวะ|furosemide|ฟูโรเซไมด์|hydrochlorothiazide|hctz|ยานอนหลับ|diazepam|ไดอะซีแพม|lorazepam|ลอราซีแพม|alprazolam|clonazepam|chlorpheniramine|คลอร์เฟนิรามีน|ยาแก้แพ้ชนิดง่วง/i,
  dm_lipid: /ยาลดน้ำตาล|metformin|เมทฟอร์มิน|glipizide|glibenclamide|gliclazide|insulin|อินซูลิน|statin|สแตติน|simvastatin|atorvastatin|ยาลดไขมัน|ยาลดคอเลสเตอรอล/i,
  dm: /ยาลดน้ำตาล|metformin|เมทฟอร์มิน|glipizide|glibenclamide|gliclazide|insulin|อินซูลิน/i,
  chronic: null, // ผู้ป่วยมียาที่ใช้ประจำรายการใดก็ได้
  pepper: /phenytoin|ฟีนิโทอิน|propranolol|โพรพราโนลอล|theophylline|ธีโอฟิลลีน|rifampicin|ไรแฟมพิซิน/i,
  cyp: /statin|สแตติน|simvastatin|atorvastatin|tamoxifen|ทาม็อกซิเฟน|amitriptyline|อะมิทริปไทลีน|phenytoin|ฟีนิโทอิน|itraconazole|ไอทราโคนาโซล|protease inhibitor/i,
};

export const HERB_DRUG: HerbDrug[] = [
  {"herb": "turmeric", "drug": "blood", "label": "ยาละลายลิ่มเลือด / ยาต้านเกล็ดเลือด", "statement": "ควรระวังการใช้ยานี้ร่วมกับสารกันเลือดเป็นลิ่ม (anticoagulants) และยาต้านการจับตัวของเกล็ดเลือด (antiplatelets)", "products": ["ยาขมิ้นชัน"], "pages": [29]},
  {"herb": "turmeric", "drug": "cyp", "label": "ยาที่ผ่านเอนไซม์ CYP450 ที่ตับ", "statement": "ควรระวังการใช้ยานี้ร่วมกับยาที่กระบวนการเมแทบอลิซึมผ่านเอนไซม์ Cytochrome P450 (CYP 450) เนื่องจากสาร curcumin ยับยั้ง CYP 3A4, CYP 1A2 แต่กระตุ้นเอนไซม์ CYP 2A6", "products": ["ยาขมิ้นชัน"], "pages": [29]},
  {"herb": "turmeric", "drug": "cancer", "label": "ยารักษาโรคมะเร็งบางชนิด", "statement": "ควรระวังการใช้ร่วมกับยารักษาโรคมะเร็งบางชนิด เช่น doxorubicin, chlormethine, cyclophosphamide และ camptothecin เนื่องจาก curcumin อาจมีผลต้านฤทธิ์ยาดังกล่าว", "products": ["ยาขมิ้นชัน"], "pages": [29]},
  {"herb": "ginger", "drug": "blood", "label": "ยาละลายลิ่มเลือด / ยาต้านเกล็ดเลือด", "statement": "ควรระวังการใช้ยานี้ร่วมกับสารกันเลือดเป็นลิ่ม (anticoagulants) และยาต้านการจับตัวของเกล็ดเลือด (antiplatelets)", "products": ["ยาขิง"], "pages": [30, 45]},
  {"herb": "andrographis", "drug": "blood", "label": "ยาละลายลิ่มเลือด / ยาต้านเกล็ดเลือด", "statement": "ระวังการใช้ยานี้ร่วมกับสารกันเลือดเป็นลิ่ม (anticoagulants) เช่น warfarin, ยากลุ่ม NOACs และยาต้านการจับตัวของเกล็ดเลือด (antiplatelets)", "products": ["ยาฟ้าทะลายโจร"], "pages": [41, 62, 91, 92]},
  {"herb": "andrographis", "drug": "bp", "label": "ยาลดความดันโลหิต", "statement": "ควรระวังการใช้ยานี้ร่วมกับยาลดความดันเลือดเพราะอาจเสริมฤทธิ์กันได้", "products": ["ยาฟ้าทะลายโจร"], "pages": [41, 62]},
  {"herb": "andrographis", "drug": "cyp", "label": "ยาที่ผ่านเอนไซม์ CYP450 ที่ตับ", "statement": "ระวังการใช้ยานี้ร่วมกับยาที่กระบวนการเมแทบอลิซึมผ่านเอนไซม์ cytochrome P450 (CYP450) เนื่องจากฟ้าทะลายโจรมีฤทธิ์ยับยั้งเอนไซม์ CYP1A2 เช่น tamoxifen, CYP2C9 เช่น amitriptyline, phenytoin และ เอนไซม์ CYP3A4 เช่น ยากลุ่ม statins, ยากลุ่ม protease inhibitors และ itraconazole", "products": ["ยาฟ้าทะลายโจร"], "pages": [41, 62, 91, 92]},
  {"herb": "centella", "drug": "liver_diuretic_sedative", "label": "ยาที่มีผลต่อตับ ยาขับปัสสาวะ ยาที่ทำให้ง่วง", "statement": "ควรระวังการใช้ยานี้ร่วมกับยาที่มีผลต่อตับ ยาขับปัสสาวะ และยาที่มีผลข้างเคียงทำให้ง่วงนอน เพราะอาจเสริมฤทธิ์กันได้", "products": ["ยาบัวบก"], "pages": [52]},
  {"herb": "centella", "drug": "dm_lipid", "label": "ยาลดน้ำตาลและยาลดคอเลสเตอรอล", "statement": "บัวบกอาจเพิ่มระดับน้ำตาลและคอเลสเตอรอลในเลือด และทำให้ประสิทธิผลของยาลดน้ำตาลและยาลดคอเลสเตอรอลลดลง", "products": ["ยาบัวบก"], "pages": [52]},
  {"herb": "centella", "drug": "cyp", "label": "ยาที่ผ่านเอนไซม์ CYP450 ที่ตับ", "statement": "ควรระวังการใช้ร่วมกับยาที่มีกระบวนการเมแทบอลิซึมผ่าน Cytochrome P450 (CYP 450) เนื่องจากบัวบกมีฤทธิ์ยับยั้งเอนไซม์ CYP 2C9 และ CYP 2C19", "products": ["ยาบัวบก"], "pages": [52]},
  {"herb": "bittergourd", "drug": "dm", "label": "ยาลดน้ำตาลในเลือด / อินซูลิน", "statement": "ควรระวังการใช้ยานี้ร่วมกับยาลดน้ำตาลในเลือดชนิดรับประทาน (Oral Hypoglycemic Agents) อื่น ๆ หรือร่วมกับการฉีดอินซูลิน เพราะอาจทำให้เกิดการเสริมฤทธิ์กันได้", "products": ["ยามะระขี้นก"], "pages": [54]},
  {"herb": "rangjuet", "drug": "chronic", "label": "ยาที่ต้องใช้ต่อเนื่องสำหรับโรคเรื้อรัง", "statement": "ควรระวังการใช้ยานี้กับผู้ป่วยที่ต้องใช้ยารักษาโรคอย่างต่อเนื่อง เพราะยารางจืดอาจเร่งการขับยาเหล่านั้นออกจากร่างกาย ทำให้ประสิทธิผลของยาลดลง", "products": ["ยารางจืด"], "pages": [55, 82]},
  {"herb": "catswhiskers", "drug": "dm", "label": "ยาลดน้ำตาลในเลือด / อินซูลิน", "statement": "ควรระวังการใช้ยานี้ร่วมกับยาลดน้ำตาลในเลือดชนิดรับประทาน (Oral hypoglycemic agents) หรือร่วมกับการฉีดอินซูลิน เพราะอาจเสริมฤทธิ์กันได้", "products": ["ยาหญ้าหนวดแมว"], "pages": [82]},
  {"herb": "blackpepper", "drug": "pepper", "label": "phenytoin, propranolol, theophylline, rifampicin", "statement": "ควรระวังการใช้ยานี้ร่วมกับยา phenytoin, propranolol, theophylline และ rifampicin เนื่องจากตำรับนี้มีพริกไทยในปริมาณสูง", "products": ["ยาธรณีสันฑะฆาต", "ยาปลูกไฟธาตุ", "ยาปราบชมพูทวีป", "ยาทำลายพระสุเมรุ", "ยาสหัศธารา", "ยาอัมฤตย์โอสถ", "ยาตรีพิกัด"], "pages": [38, 49, 60, 66, 73, 75, 77], "formula": true},
  {"herb": "longpepper", "drug": "pepper", "label": "phenytoin, propranolol, theophylline, rifampicin", "statement": "ควรระวังการใช้ยานี้ร่วมกับยา phenytoin, propranolol, theophylline และ rifampicin เนื่องจากตำรับนี้มีดีปลีในปริมาณสูง", "products": ["ยาวิสัมพยาใหญ่", "ยาตรีพิกัด"], "pages": [36, 77], "formula": true},
];

/** สมุนไพรที่ตรวจในประกาศแล้ว ไม่พบการระบุยาที่ตีกัน */
export const CHECKED_NO_DRUG = ["senna", "chumhetthet", "thaowanpriang", "plai", "beijinggrass", "littleironweed", "roselle", "aloe", "betel", "rhinacanthus", "phayayo"];
