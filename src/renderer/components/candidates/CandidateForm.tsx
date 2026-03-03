import React from 'react';
import { createPortal } from 'react-dom';
import { i18nService } from '../../services/i18n';
import {
  XMarkIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

interface CandidateFormProps {
  onClose: () => void;
  onSubmit: (data: CandidateFormData) => Promise<void>;
  interviewCodes?: Array<{ interviewCode: string; name: string }>;
  loading?: boolean;
}

export interface CandidateFormData {
  name: string;
  phone: string;
  email?: string;
  position?: string;
  interviewCode: string;
}

export const CandidateForm: React.FC<CandidateFormProps> = ({
  onClose,
  onSubmit,
  interviewCodes = [],
  loading = false,
}) => {
  const [formData, setFormData] = React.useState<CandidateFormData>({
    name: '',
    phone: '',
    email: '',
    position: '',
    interviewCode: interviewCodes[0]?.interviewCode || '',
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof CandidateFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CandidateFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = i18nService.t('candidatesFormNameRequired');
    }
    if (!formData.phone.trim()) {
      newErrors.phone = i18nService.t('candidatesFormPhoneRequired');
    } else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = i18nService.t('candidatesFormPhoneInvalid');
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = i18nService.t('candidatesFormEmailInvalid');
    }
    if (!formData.interviewCode) {
      newErrors.interviewCode = i18nService.t('candidatesFormInterviewCodeRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit({
        ...formData,
        email: formData.email || undefined,
        position: formData.position || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to submit form:', error);
    }
  };

  const handleChange = (field: keyof CandidateFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {i18nService.t('candidatesFormTitle')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Interview Code Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {i18nService.t('candidatesFormInterviewCode')} *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-400" />
              </div>
              <select
                value={formData.interviewCode}
                onChange={(e) => handleChange('interviewCode', e.target.value)}
                className={`w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white ${
                  errors.interviewCode ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="">{i18nService.t('candidatesFormSelectInterview')}</option>
                {interviewCodes.map((item) => (
                  <option key={item.interviewCode} value={item.interviewCode}>
                    {item.name} ({item.interviewCode})
                  </option>
                ))}
              </select>
            </div>
            {errors.interviewCode && (
              <p className="mt-1 text-xs text-red-500">{errors.interviewCode}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {i18nService.t('candidatesFormName')} *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <UserIcon className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={i18nService.t('candidatesFormNamePlaceholder')}
                className={`w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white ${
                  errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {i18nService.t('candidatesFormPhone')} *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <PhoneIcon className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder={i18nService.t('candidatesFormPhonePlaceholder')}
                className={`w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white ${
                  errors.phone ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>
            {errors.phone && (
              <p className="mt-1 text-xs text-red-500">{errors.phone}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {i18nService.t('candidatesFormEmail')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <EnvelopeIcon className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder={i18nService.t('candidatesFormEmailPlaceholder')}
                className={`w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white ${
                  errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {i18nService.t('candidatesFormPosition')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <BriefcaseIcon className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => handleChange('position', e.target.value)}
                placeholder={i18nService.t('candidatesFormPositionPlaceholder')}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              {i18nService.t('commonCancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {i18nService.t('candidatesFormSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CandidateForm;
