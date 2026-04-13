import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiFetch, setToken } from "../lib/api";
import { useAppTheme, type AppColors } from "../lib/theme";
import type { RootStackParamList } from "../types";

type Nav = NativeStackNavigationProp<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: { navigation: Nav }) {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loginWithCredentials(loginEmail: string, loginPassword: string) {
    const tok = await apiFetch<{ access_token: string }>("/auth/login", {
      auth: false,
      method: "POST",
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    await setToken(tok.access_token);
    navigation.replace("Main");
  }

  async function login() {
    setErr(null);
    setBusy(true);
    try {
      await loginWithCredentials(email, password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    setErr(null);
    setBusy(true);
    try {
      await apiFetch<{ id: number; name: string; email: string; created_at: string }>(
        "/auth/register",
        {
          auth: false,
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        }
      );
      await loginWithCredentials(email, password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  const submit = mode === "login" ? login : register;

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.headerCard}>
        <Text style={styles.title}>FlockLedger</Text>
        <Text style={styles.sub}>{mode === "login" ? "Sign in" : "Create account"}</Text>
      </View>
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === "login" && styles.modeBtnOn]}
          onPress={() => {
            setMode("login");
            setErr(null);
          }}
          disabled={busy}
        >
          <Text style={[styles.modeBtnText, mode === "login" && styles.modeBtnTextOn]}>Sign in</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === "register" && styles.modeBtnOn]}
          onPress={() => {
            setMode("register");
            setErr(null);
          }}
          disabled={busy}
        >
          <Text style={[styles.modeBtnText, mode === "register" && styles.modeBtnTextOn]}>
            Register
          </Text>
        </Pressable>
      </View>
      {mode === "register" ? (
        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor={colors.placeholder}
          value={name}
          onChangeText={setName}
          editable={!busy}
        />
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        keyboardType="email-address"
        keyboardAppearance={colors.isDark ? "dark" : "light"}
        value={email}
        onChangeText={setEmail}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        keyboardAppearance={colors.isDark ? "dark" : "light"}
        selectionColor={colors.accent}
        value={password}
        onChangeText={setPassword}
        editable={!busy}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={submit}
        disabled={busy || !email.trim() || !password.trim() || (mode === "register" && !name.trim())}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>{mode === "login" ? "Sign in" : "Create account"}</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 30, fontWeight: "800", color: colors.accentStrong },
  sub: { marginTop: 4, color: colors.textMuted },
  modeRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  modeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  modeBtnOn: { backgroundColor: colors.accentSoft },
  modeBtnText: { color: colors.textSoft, fontWeight: "600" },
  modeBtnTextOn: { color: colors.accentText },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
  },
  err: { color: colors.danger, marginBottom: 8 },
  btn: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.85 },
  btnText: { color: colors.inverseText, fontWeight: "600" },
});
