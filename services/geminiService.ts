
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TransactionType, RiskLevel, BusinessProfile } from "../types";

// Hàm helper để lấy API key từ Vite env
const getApiKey = (): string | null => {
  // Vite sử dụng import.meta.env thay vì process.env
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY ||
                 (import.meta as any).env?.VITE_API_KEY ||
                 (typeof process !== 'undefined' ? process.env?.VITE_GEMINI_API_KEY : null);

  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    console.warn("⚠️ Cảnh báo: VITE_GEMINI_API_KEY chưa được cấu hình trong environment variables.");
    return null;
  }
  return apiKey;
};

// Hàm helper để lấy client
const getGenAIClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY_NOT_CONFIGURED");
  }
  return new GoogleGenAI({ apiKey });
};

// --- SYSTEM INSTRUCTIONS ---

const ONBOARDING_INSTRUCTION = `
Bạn là hệ thống OCR trích xuất dữ liệu từ "Giấy chứng nhận đăng ký hộ kinh doanh" tại Việt Nam.

NHIỆM VỤ: Tìm và điền dữ liệu vào JSON. 

QUY TẮC MAP DỮ LIỆU (QUAN TRỌNG):

1. **taxId (Bắt buộc phải có)**:
   - Trên giấy này thường KHÔNG ghi là "Mã số thuế".
   - Hãy quét toàn bộ văn bản để tìm các từ khóa sau ở phần đầu trang: **"Mã số hộ kinh doanh"**, **"Số đăng ký kinh doanh"**, **"Số ĐKKD"**, hoặc chỉ đơn giản là **"Số:"**.
   - Lấy toàn bộ chuỗi ký tự nằm ngay sau các từ khóa đó.
   - CHẤP NHẬN mọi định dạng:
     - Số thuần (ví dụ: 0101234567)
     - Số có gạch ngang (ví dụ: **0315758623-001**) -> Lấy đầy đủ cả đuôi.
     - Mã lai chữ và số (ví dụ: **41P8012345**) -> Lấy đầy đủ.
   - Nếu có nhiều số, ưu tiên số nằm cạnh dòng "Mã số hộ kinh doanh".

2. **name**:
   - Tên hộ kinh doanh, thường viết IN HOA đậm (Ví dụ: HỘ KINH DOANH MINH LONG).

3. **address**:
   - Địa điểm kinh doanh / Địa chỉ trụ sở.

4. **industry**:
   - Ngành, nghề kinh doanh (Lấy ngành chính).

5. **industryCode**:
   - Tìm mã ngành kinh tế (VSIC) thường gồm 4 hoặc 5 chữ số đi kèm với tên ngành nghề.
   - Ví dụ: "4711 - Bán lẻ lương thực" -> Lấy "4711".
   - Nếu không thấy, trả về chuỗi rỗng.

6. **ownerName**:
   - Họ và tên cá nhân / chủ hộ.

Nếu hình ảnh quá mờ không đọc được số, trả về chuỗi rỗng "". Đừng tự bịa số.
`;

const CHAT_INSTRUCTION = `
Bạn là TaxMate, "Kế toán trưởng ảo" chuyên nghiệp cho Hộ kinh doanh tại Việt Nam.
Luật áp dụng: Thông tư 88/2021/TT-BTC về chế độ kế toán Hộ kinh doanh.

NHIỆM VỤ: Trích xuất thông tin Giao dịch (Doanh thu/Chi phí) từ câu nói của người dùng.

QUY TẮC QUAN TRỌNG NHẤT:
1. Khi người dùng đề cập đến số tiền, mua bán, nhập hàng -> BẮT BUỘC trả về JSON \`extractedTransaction\`.
2. KHÔNG ĐƯỢC TỰ Ý nói "Đã ghi sổ", "Đã lưu", "Đã xong" trong câu trả lời (\`reply\`).
3. Thay vào đó, hãy nói: "Tôi đã lập phiếu này, bạn kiểm tra lại nhé?" hoặc "Vui lòng xác nhận thông tin dưới đây:".
4. Nếu người dùng nhập "Tôi đã ghi nhận...", hãy hiểu đó là họ đang khai báo giao dịch mới -> TRÍCH XUẤT NGAY.

QUY TẮC XỬ LÝ GIAO DỊCH:
1. PHÂN BIỆT HÀNG HÓA VÀ CHI PHÍ: 
   - Nếu người dùng dùng từ "nhập hàng", "mua về bán", hoặc tên các mặt hàng phổ thông (Coca, mì tôm, thuốc lá, gạo, nước ngọt...) và ngành nghề của họ là "Bán lẻ", "Tạp hóa", "Ăn uống" -> Đây là CHI PHÍ HỢP LỆ (Nhập hàng hóa). Đặt RiskLevel.SAFE.
   - TUYỆT ĐỐI KHÔNG được tự ý đổi tên hàng hóa (ví dụ: Coca) thành dịch vụ giải trí (ví dụ: Karaoke).

2. CHI PHÍ CÁ NHÂN (LOẠI BỎ):
   - Chỉ đánh dấu RiskLevel.HIGH nếu đó rõ ràng là dịch vụ không phục vụ kinh doanh: Karaoke (đi hát), Massage, Mua đồ gia dụng cho nhà riêng, Đi chợ nấu cơm gia đình.
   - Giải thích: "Chi phí cá nhân không được trừ khi tính thuế HKD".

3. CHI PHÍ NHẠY CẢM: 
   - Tiếp khách, xăng xe vượt định mức -> RiskLevel.WARNING.

4. TRÍCH XUẤT DỮ LIỆU (QUAN TRỌNG VỀ THỜI GIAN):
   - Luôn trích xuất đúng số tiền (amount), nội dung (description), loại (type: INCOME/EXPENSE), và danh mục (category).
   - NGÀY GIAO DỊCH (date): 
     - **Ưu tiên SỐ 1**: Nếu người dùng nhắc cụ thể năm (Ví dụ: "năm 2026", "số liệu 2026"), BẮT BUỘC dùng năm đó.
     - Nếu người dùng chỉ nhập ngày/tháng (Ví dụ: "ngày 19/01"), hãy mặc định là năm hiện tại (2025).
     - Trả về ISO Date: YYYY-MM-DD.

Yêu cầu trả về JSON chính xác.
`;

// --- SCHEMAS ---

const profileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    taxId: { 
        type: Type.STRING, 
        description: "Chuỗi ký tự đại diện cho Mã số hộ kinh doanh hoặc Số ĐKKD tìm thấy trên giấy. Ví dụ: 0312345678-001 hoặc 41X8000123." 
    },
    address: { type: Type.STRING },
    industry: { type: Type.STRING },
    industryCode: { type: Type.STRING, description: "Mã ngành VSIC cấp 4 hoặc 5 (VD: 4711)" },
    ownerName: { type: Type.STRING },
  },
  required: ["name", "taxId"]
};

const chatResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    extractedTransaction: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        date: { type: Type.STRING, description: "Ngày giao dịch định dạng YYYY-MM-DD. Nếu người dùng nói năm 2026, hãy điền 2026-xx-xx." },
        amount: { type: Type.NUMBER },
        description: { type: Type.STRING },
        type: { type: Type.STRING, enum: [TransactionType.INCOME, TransactionType.EXPENSE] },
        category: { type: Type.STRING },
        riskLevel: { type: Type.STRING, enum: [RiskLevel.SAFE, RiskLevel.WARNING, RiskLevel.HIGH] },
        riskNote: { type: Type.STRING }
      },
      required: ["amount", "description", "type", "category", "riskLevel", "date"]
    }
  },
  required: ["reply"]
};

// --- FUNCTIONS ---

export const analyzeBusinessLicense = async (base64Image: string): Promise<BusinessProfile | null> => {
  try {
    const ai = getGenAIClient(); // Khởi tạo client tại đây
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
          { text: "Trích xuất dữ liệu: Tìm dòng 'Mã số hộ kinh doanh' điền vào taxId. Tìm mã ngành điền vào industryCode." }
        ]
      },
      config: {
        systemInstruction: ONBOARDING_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: profileSchema,
        temperature: 0.0, // Set to 0.0 for maximum determinism in OCR
      },
    });

    const text = response.text;
    if (!text) return null;
    
    // Đôi khi model trả về markdown code block dù đã set MIME type, cần xử lý
    const cleanJson = text.replace(/```json|```/g, "").trim();
    
    return JSON.parse(cleanJson) as BusinessProfile;
  } catch (e) {
    console.error("Onboarding Error", e);
    return null;
  }
};

export const sendMessageToGemini = async (
  message: string,
  base64Image?: string,
  businessContext?: BusinessProfile
): Promise<{ reply: string; transaction: any | null }> => {
  try {
    const ai = getGenAIClient(); // Khởi tạo client tại đây để đảm bảo lấy được API key mới nhất
    
    const parts: any[] = [];
    if (base64Image) {
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
        parts.push({ inlineData: { data: cleanBase64, mimeType: "image/jpeg" } });
    }
    
    // Thêm ngày hiện tại vào context
    const todayStr = new Date().toLocaleDateString('en-GB'); // Định dạng dd/mm/yyyy chuẩn quốc tế để tránh lỗi locale
    let contextStr = `\n[Hôm nay: ${todayStr}]`;

    if (businessContext) {
      contextStr += `\n[Context: HKD ${businessContext.name}, Ngành: ${businessContext.industry}]`;
    }

    parts.push({ text: message + contextStr });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // Sử dụng model ổn định hơn gemini-3-flash-preview
      contents: { parts: parts },
      config: {
        systemInstruction: CHAT_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: chatResponseSchema,
        temperature: 0.2, // Tăng nhẹ để AI linh hoạt hơn
      },
    });

    const text = response.text;
    if (!text) throw new Error("API trả về dữ liệu rỗng");
    
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    
    return {
      reply: parsed.reply,
      transaction: parsed.extractedTransaction || null,
    };

  } catch (error: any) {
    console.error("Gemini Chat Error Full Details:", error);

    // Xử lý thông báo lỗi chi tiết để hiển thị cho người dùng
    let errorMessage = "Hệ thống đang bận. Vui lòng thử lại sau.";

    if (error.message === "API_KEY_NOT_CONFIGURED" || !getApiKey()) {
        errorMessage = "⚠️ Tính năng AI chưa được kích hoạt. Vui lòng liên hệ quản trị viên để cấu hình API Key.";
    } else if (error.message) {
        if (error.message.includes("401")) errorMessage = "Lỗi xác thực: API Key không hợp lệ (401).";
        else if (error.message.includes("403")) errorMessage = "Lỗi quyền truy cập: API Key không được phép (403).";
        else if (error.message.includes("404")) errorMessage = "Lỗi model: Model AI không tìm thấy hoặc chưa được cấp quyền (404).";
        else if (error.message.includes("429")) errorMessage = "Hệ thống quá tải: Vui lòng đợi vài giây (429).";
        else if (error.message.includes("API_KEY")) errorMessage = "⚠️ Chưa cấu hình API Key cho AI.";
        else errorMessage = `Lỗi AI: ${error.message}`;
    }

    return {
      reply: errorMessage,
      transaction: null
    };
  }
};
