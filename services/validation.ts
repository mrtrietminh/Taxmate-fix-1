/**
 * Input validation utilities for forms
 * Provides validation rules for Vietnamese business data
 */

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validate Vietnamese phone number
 * Accepts formats: 09x, 08x, 07x, 03x, 05x (10 digits)
 */
export function validatePhoneNumber(phone: string): ValidationResult {
    // Remove spaces and dashes
    const cleaned = phone.replace(/[\s-]/g, '');

    if (!cleaned) {
        return { isValid: false, error: 'Vui lòng nhập số điện thoại' };
    }

    // Vietnamese phone number pattern
    const phoneRegex = /^(0[35789])[0-9]{8}$/;

    if (!phoneRegex.test(cleaned)) {
        return { isValid: false, error: 'Số điện thoại không hợp lệ (phải có 10 số, bắt đầu bằng 03, 05, 07, 08, hoặc 09)' };
    }

    return { isValid: true };
}

/**
 * Validate PIN (6 digits)
 */
export function validatePin(pin: string): ValidationResult {
    if (!pin) {
        return { isValid: false, error: 'Vui lòng nhập mã PIN' };
    }

    if (pin.length !== 6) {
        return { isValid: false, error: 'Mã PIN phải có đúng 6 chữ số' };
    }

    if (!/^\d{6}$/.test(pin)) {
        return { isValid: false, error: 'Mã PIN chỉ được chứa số' };
    }

    // Check for simple patterns (optional security enhancement)
    const simplePatterns = ['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321'];
    if (simplePatterns.includes(pin)) {
        return { isValid: false, error: 'Mã PIN quá đơn giản, vui lòng chọn mã khác' };
    }

    return { isValid: true };
}

/**
 * Validate Vietnamese Tax ID (Mã số thuế)
 * Format: 10 digits or 13 digits (10-digit base + 3-digit branch code)
 * Example: 0123456789 or 0123456789-001
 */
export function validateTaxId(taxId: string): ValidationResult {
    if (!taxId) {
        return { isValid: false, error: 'Vui lòng nhập mã số thuế' };
    }

    // Remove spaces and normalize dashes
    const cleaned = taxId.replace(/[\s]/g, '').replace(/[-–—]/g, '-');

    // Pattern: 10 digits or 10 digits + hyphen + 3 digits
    const taxIdRegex = /^[0-9]{10}(-[0-9]{3})?$/;

    if (!taxIdRegex.test(cleaned)) {
        return { isValid: false, error: 'Mã số thuế không hợp lệ (10 số hoặc 10 số-3 số chi nhánh)' };
    }

    return { isValid: true };
}

/**
 * Validate business name
 */
export function validateBusinessName(name: string): ValidationResult {
    if (!name || !name.trim()) {
        return { isValid: false, error: 'Vui lòng nhập tên hộ kinh doanh' };
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return { isValid: false, error: 'Tên hộ kinh doanh phải có ít nhất 2 ký tự' };
    }

    if (trimmed.length > 200) {
        return { isValid: false, error: 'Tên hộ kinh doanh không được quá 200 ký tự' };
    }

    // Check for invalid characters (allow Vietnamese, alphanumeric, spaces, and common punctuation)
    const nameRegex = /^[\p{L}\p{N}\s.,&()-]+$/u;
    if (!nameRegex.test(trimmed)) {
        return { isValid: false, error: 'Tên hộ kinh doanh chứa ký tự không hợp lệ' };
    }

    return { isValid: true };
}

/**
 * Validate address
 */
export function validateAddress(address: string): ValidationResult {
    if (!address || !address.trim()) {
        // Address is optional, return valid if empty
        return { isValid: true };
    }

    const trimmed = address.trim();

    if (trimmed.length > 500) {
        return { isValid: false, error: 'Địa chỉ không được quá 500 ký tự' };
    }

    return { isValid: true };
}

/**
 * Validate industry code (VSIC code)
 * Format: 4-5 digits
 */
export function validateIndustryCode(code: string): ValidationResult {
    if (!code || !code.trim()) {
        // Industry code is optional
        return { isValid: true };
    }

    const cleaned = code.trim();

    // VSIC codes are 4-5 digits
    const codeRegex = /^[0-9]{4,5}$/;
    if (!codeRegex.test(cleaned)) {
        return { isValid: false, error: 'Mã ngành phải có 4-5 chữ số (theo VSIC)' };
    }

    return { isValid: true };
}

/**
 * Validate owner name
 */
export function validateOwnerName(name: string): ValidationResult {
    if (!name || !name.trim()) {
        // Owner name is optional
        return { isValid: true };
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return { isValid: false, error: 'Họ tên phải có ít nhất 2 ký tự' };
    }

    if (trimmed.length > 100) {
        return { isValid: false, error: 'Họ tên không được quá 100 ký tự' };
    }

    // Vietnamese names: letters, spaces, and dots (for abbreviations)
    const nameRegex = /^[\p{L}\s.]+$/u;
    if (!nameRegex.test(trimmed)) {
        return { isValid: false, error: 'Họ tên chỉ được chứa chữ cái và dấu cách' };
    }

    return { isValid: true };
}

/**
 * Validate industry/business type
 */
export function validateIndustry(industry: string): ValidationResult {
    if (!industry || !industry.trim()) {
        // Industry is optional
        return { isValid: true };
    }

    const trimmed = industry.trim();

    if (trimmed.length > 200) {
        return { isValid: false, error: 'Ngành nghề không được quá 200 ký tự' };
    }

    return { isValid: true };
}

/**
 * Sanitize input to prevent XSS
 * Removes potentially dangerous characters while preserving Vietnamese text
 */
export function sanitizeInput(input: string): string {
    if (!input) return '';

    return input
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove script-like patterns
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        // Trim whitespace
        .trim();
}

/**
 * Validate and sanitize a complete business profile
 */
export function validateBusinessProfile(profile: {
    name: string;
    taxId: string;
    address?: string;
    industry?: string;
    industryCode?: string;
    ownerName?: string;
}): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    const nameResult = validateBusinessName(profile.name);
    if (!nameResult.isValid) errors.name = nameResult.error!;

    const taxIdResult = validateTaxId(profile.taxId);
    if (!taxIdResult.isValid) errors.taxId = taxIdResult.error!;

    if (profile.address) {
        const addressResult = validateAddress(profile.address);
        if (!addressResult.isValid) errors.address = addressResult.error!;
    }

    if (profile.industry) {
        const industryResult = validateIndustry(profile.industry);
        if (!industryResult.isValid) errors.industry = industryResult.error!;
    }

    if (profile.industryCode) {
        const codeResult = validateIndustryCode(profile.industryCode);
        if (!codeResult.isValid) errors.industryCode = codeResult.error!;
    }

    if (profile.ownerName) {
        const ownerResult = validateOwnerName(profile.ownerName);
        if (!ownerResult.isValid) errors.ownerName = ownerResult.error!;
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}
