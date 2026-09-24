const requiredVariables = [
  'NEXT_PUBLIC_MICROSOFT_CLIENT_ID',
  'NEXT_PUBLIC_MICROSOFT_TENANT_ID',
];

const missingVariables = requiredVariables.filter(
  (variableName) => !process.env[variableName]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(
    `Authenticated GitHub Pages build stopped. Missing: ${missingVariables.join(', ')}`,
  );
  process.exit(1);
}

console.log('Microsoft public authentication configuration is present.');
