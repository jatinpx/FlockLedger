import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiFetch, setToken } from "../lib/api";
import type { RootStackParamList } from "../types";

type Nav = NativeStackNavigationProp<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: { navigation: Nav }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function login() {
    setErr(null);
    try {
      const tok = await apiFetch<{ access_token: string }>("/auth/login", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await setToken(tok.access_token);
      navigation.replace("FarmOverview");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>FlockLedger</Text>
      <Text style={styles.sub}>Worker sign in</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable style={styles.btn} onPress={login}>
        <Text style={styles.btnText}>Sign in</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fafafa" },
  title: { fontSize: 28, fontWeight: "700", color: "#065f46" },
  sub: { marginTop: 4, marginBottom: 24, color: "#71717a" },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  err: { color: "#b91c1c", marginBottom: 8 },
  btn: { backgroundColor: "#047857", padding: 14, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
});
