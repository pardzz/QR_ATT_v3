# QR-ATT setup
1. In Supabase, open SQL Editor and run `supabase.sql`. For testing, go to Authentication > Providers > Email and turn off "Confirm email".
2. In this project directory, run `npm install`.
3. To preview in a browser, run `npm run web` and open the local URL printed by Expo (usually http://localhost:8081).
4. To run on a phone, run `npx expo start -c` and scan the terminal QR code with Expo Go.
5. To build an installable Android APK with Expo, sign in with `npx eas-cli login`, then run `npx eas-cli build --platform android --profile preview`. Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` to the Expo project's `preview` environment first; `.env` is intentionally excluded from cloud uploads.

The `.env` file must contain `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` for your Supabase project. Keep `.env` out of public Git. Only use the publishable key; never add a service-role key.

The UI-only update does not change `supabase.sql`, so existing databases do not need additional migrations. The first account registered is the Administrator.
