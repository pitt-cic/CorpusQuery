import { useAuthenticator } from '@aws-amplify/ui-react';
import type { AuthenticatorProps } from '@aws-amplify/ui-react';

export const authFormFields: AuthenticatorProps['formFields'] = {
  signIn: {
    username: {
      label: 'Email or Username',
      placeholder: 'Enter your email or username',
    },
    password: {
      label: 'Password',
      placeholder: 'Enter your password',
    },
  },
  forceNewPassword: {
    given_name: {
      label: 'First Name',
      placeholder: 'Enter your first name',
      order: 1,
      isRequired: true,
    },
    family_name: {
      label: 'Last Name',
      placeholder: 'Enter your last name',
      order: 2,
      isRequired: true,
    },
    password: {
      label: 'New Password',
      placeholder: 'Enter your new password',
      order: 3,
    },
    confirm_password: {
      label: 'Confirm Password',
      placeholder: 'Confirm your new password',
      order: 4,
    },
  },
  forgotPassword: {
    username: {
      label: 'Email',
      placeholder: 'Enter your email address',
    },
  },
  confirmResetPassword: {
    confirmation_code: {
      label: 'Verification Code',
      placeholder: 'Enter your verification code',
    },
    password: {
      label: 'New Password',
      placeholder: 'Enter your new password',
    },
    confirm_password: {
      label: 'Confirm Password',
      placeholder: 'Confirm your new password',
    },
  },
};

export const authComponents: AuthenticatorProps['components'] = {
  Header() {
    return null;
  },
  SignIn: {
    Header() {
      return (
        <div className="auth-header">
          <h1 className="font-serif text-2xl text-gold text-center">CorpusQuery</h1>
        </div>
      );
    },
    Footer() {
      const { toForgotPassword } = useAuthenticator();
      return (
        <div className="text-center mt-2 mb-4">
          <button
            onClick={toForgotPassword}
            className="font-sans text-sm text-ink-muted hover:text-gold underline bg-transparent border-none cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
      );
    },
  },
  ForceNewPassword: {
    Header() {
      return (
        <p className="font-sans text-sm text-ink-muted text-center mb-4">
          Set Up Your Account
        </p>
      );
    },
  },
  ForgotPassword: {
    Header() {
      return (
        <p className="font-sans text-sm text-ink-muted text-center mb-4">
          Reset Your Password
        </p>
      );
    },
  },
  ConfirmResetPassword: {
    Header() {
      return (
        <p className="font-sans text-sm text-ink-muted text-center mb-4">
          Enter Verification Code
        </p>
      );
    },
  },
};
