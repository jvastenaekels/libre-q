import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { customInstance } from '@/api/mutator';
import {
    useSetupTotpApiMe2faSetupGet,
    useEnableTotpApiMe2faEnablePost,
    useDisableTotpApiMe2faDisablePost,
} from '@/api/generated';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, ShieldCheck, ShieldAlert, Key, Copy, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Define types manually since generation might lag
interface UserUpdate {
    email?: string;
    full_name?: string;
}

interface PasswordChange {
    current_password: string;
    new_password: string;
}

const ProfilePage = () => {
    const { user, refetch: refetchUser } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // 2FA State
    const [is2FASetupMode, setIs2FASetupMode] = useState(false);
    const [totpToken, setTotpToken] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showDisableConfirm, setShowDisableConfirm] = useState(false);

    const { data: totpSetup, isLoading: isSetupLoading } = useSetupTotpApiMe2faSetupGet({
        query: {
            enabled: is2FASetupMode && !user?.is_totp_enabled,
        },
    });

    const enableMutation = useEnableTotpApiMe2faEnablePost({
        mutation: {
            onSuccess: () => {
                toast.success('Two-factor authentication enabled');
                setIs2FASetupMode(false);
                setTotpToken('');
                refetchUser();
            },
            // biome-ignore lint/suspicious/noExplicitAny: error handling
            onError: (err: any) => {
                toast.error(err?.response?.data?.detail || 'Invalid token');
            },
        },
    });

    const disableMutation = useDisableTotpApiMe2faDisablePost({
        mutation: {
            onSuccess: () => {
                toast.success('Two-factor authentication disabled');
                setShowDisableConfirm(false);
                setConfirmPassword('');
                refetchUser();
            },
            // biome-ignore lint/suspicious/noExplicitAny: error handling
            onError: (err: any) => {
                toast.error(err?.response?.data?.detail || 'Failed to disable 2FA');
            },
        },
    });

    const { register: registerProfile, handleSubmit: handleProfileSubmit } = useForm<UserUpdate>({
        values: {
            email: user?.email,
            full_name: user?.full_name || '',
        },
    });

    const {
        register: registerPassword,
        handleSubmit: handlePasswordSubmit,
        reset: resetPassword,
        formState: { errors: passwordErrors },
    } = useForm<PasswordChange>();

    const onProfileSubmit = async (data: UserUpdate) => {
        setIsUpdating(true);
        try {
            await customInstance<void>({
                url: '/api/me',
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                data,
            });
            toast.success('Profile updated successfully');
            // Force reload or re-fetch user would be ideal here
            window.location.reload();
        } catch (error) {
            toast.error('Failed to update profile');
            console.error(error);
        } finally {
            setIsUpdating(false);
        }
    };

    const onPasswordSubmit = async (data: PasswordChange) => {
        setIsChangingPassword(true);
        try {
            await customInstance<void>({
                url: '/api/me/password',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data,
            });
            toast.success('Password changed successfully');
            resetPassword();
        } catch (error) {
            toast.error('Failed to change password. check current password.');
            console.error(error);
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="container max-w-4xl py-10 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile & Security</h1>
                <p className="text-muted-foreground">
                    Manage your personal information and account security.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Profile Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Update your name and contact details.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    {...registerProfile('email')}
                                    disabled
                                    className="bg-muted"
                                />
                                <p className="text-[0.8rem] text-muted-foreground">
                                    Email cannot be changed directly. Contact admin.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="full_name">Full Name</Label>
                                <Input
                                    id="full_name"
                                    placeholder="John Doe"
                                    {...registerProfile('full_name')}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                {/* Two-Factor Authentication (2FA) */}
                <Card
                    className={
                        user?.is_totp_enabled
                            ? 'border-green-100 bg-green-50/10'
                            : 'border-slate-200'
                    }
                >
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2">
                                    Two-Factor Authentication (2FA)
                                    {user?.is_totp_enabled && (
                                        <Badge className="bg-green-100 text-green-700 border-green-200">
                                            Enabled
                                        </Badge>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Add an extra layer of security to your account using TOTP.
                                </CardDescription>
                            </div>
                            <div
                                className={
                                    user?.is_totp_enabled ? 'text-green-600' : 'text-slate-400'
                                }
                            >
                                {user?.is_totp_enabled ? (
                                    <ShieldCheck size={32} />
                                ) : (
                                    <Shield size={32} />
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!user?.is_totp_enabled && !is2FASetupMode && (
                            <div className="flex flex-col items-start gap-4 p-4 border rounded-xl bg-slate-50 border-slate-200">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-white rounded-lg border shadow-sm mt-1">
                                        <ShieldAlert size={20} className="text-amber-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-slate-900">
                                            Your account is less secure
                                        </h4>
                                        <p className="text-sm text-slate-500">
                                            Enable two-factor authentication to protect your
                                            workspace.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setIs2FASetupMode(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                >
                                    Setup 2FA
                                </Button>
                            </div>
                        )}

                        {!user?.is_totp_enabled && is2FASetupMode && (
                            <div className="space-y-6 border rounded-xl p-6 bg-white animate-in slide-in-from-top-2 duration-300">
                                <header className="flex items-center justify-between pb-4 border-b">
                                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                        <Key size={18} className="text-indigo-600" />
                                        Configure Authenticator App
                                    </h4>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIs2FASetupMode(false)}
                                    >
                                        Cancel
                                    </Button>
                                </header>

                                <div className="grid md:grid-cols-2 gap-8 items-center">
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            1. Scan this QR code with an authenticator app.
                                        </p>
                                        <div className="p-3 bg-slate-50 rounded-lg border font-mono text-xs flex items-center justify-between select-all group">
                                            {isSetupLoading ? 'Generating...' : totpSetup?.secret}
                                            <button
                                                type="button"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 rounded"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(
                                                        totpSetup?.secret || ''
                                                    );
                                                    toast.success('Secret copied');
                                                }}
                                            >
                                                <Copy size={14} className="text-slate-500" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed rounded-2xl">
                                        {isSetupLoading ? (
                                            <div className="h-40 w-40 flex items-center justify-center animate-pulse bg-slate-100 rounded-lg">
                                                <AlertCircle className="text-slate-300" size={48} />
                                            </div>
                                        ) : (
                                            <QRCodeSVG
                                                value={totpSetup?.otpauth_uri || ''}
                                                size={160}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t">
                                    <Label
                                        htmlFor="2fa-token"
                                        className="text-sm font-bold text-slate-700"
                                    >
                                        2. Enter the 6-digit code
                                    </Label>
                                    <div className="flex gap-3">
                                        <Input
                                            id="2fa-token"
                                            placeholder="000000"
                                            className="h-12 text-center text-2xl tracking-[0.5em] font-bold max-w-[200px]"
                                            maxLength={6}
                                            value={totpToken}
                                            onChange={(e) => setTotpToken(e.target.value)}
                                        />
                                        <Button
                                            className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 font-bold"
                                            disabled={
                                                totpToken.length !== 6 || enableMutation.isPending
                                            }
                                            onClick={() =>
                                                enableMutation.mutate({
                                                    data: { token: totpToken },
                                                })
                                            }
                                        >
                                            {enableMutation.isPending
                                                ? 'Verifying...'
                                                : 'Enable 2FA'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {user?.is_totp_enabled && (
                            <div className="space-y-6">
                                <div className="p-4 border border-green-100 bg-green-50/50 rounded-xl flex items-start gap-3">
                                    <ShieldCheck size={20} className="text-green-600 mt-1" />
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-green-900">
                                            2FA is active
                                        </h4>
                                        <p className="text-sm text-green-700/80">
                                            Your account is protected.
                                        </p>
                                    </div>
                                </div>

                                {!showDisableConfirm ? (
                                    <Button
                                        variant="outline"
                                        className="text-red-600 border-red-200"
                                        onClick={() => setShowDisableConfirm(true)}
                                    >
                                        Disable 2FA
                                    </Button>
                                ) : (
                                    <div className="p-4 border border-red-100 bg-red-50/20 rounded-xl space-y-4">
                                        <Label htmlFor="disable-password">
                                            Confirm with your password
                                        </Label>
                                        <div className="flex gap-3">
                                            <Input
                                                id="disable-password"
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                            <Button
                                                variant="destructive"
                                                disabled={
                                                    !confirmPassword || disableMutation.isPending
                                                }
                                                onClick={() =>
                                                    disableMutation.mutate({
                                                        data: { password: confirmPassword },
                                                    })
                                                }
                                            >
                                                Confirm Disable
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={() => setShowDisableConfirm(false)}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Security */}
                <Card>
                    <CardHeader>
                        <CardTitle>Security</CardTitle>
                        <CardDescription>
                            Change your password to keep your account secure.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="current_password">Current Password</Label>
                                <Input
                                    id="current_password"
                                    type="password"
                                    {...registerPassword('current_password', { required: true })}
                                />
                                {passwordErrors.current_password && (
                                    <span className="text-red-500 text-xs">Required</span>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="new_password">New Password</Label>
                                <Input
                                    id="new_password"
                                    type="password"
                                    {...registerPassword('new_password', {
                                        required: true,
                                        minLength: 8,
                                    })}
                                />
                                {passwordErrors.new_password && (
                                    <span className="text-red-500 text-xs">
                                        Min 8 characters required
                                    </span>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button type="submit" disabled={isChangingPassword}>
                                {isChangingPassword ? 'Updating...' : 'Change Password'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default ProfilePage;
