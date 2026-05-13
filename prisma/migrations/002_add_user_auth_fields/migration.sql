-- Migration: 002_add_user_auth_fields
-- Adds auth fields to the users table for JWT + Azure AD SSO support

ALTER TABLE [users]
  ADD [azure_ad_object_id] UNIQUEIDENTIFIER NULL,
      [password_hash]      NVARCHAR(200)    NULL,
      [refresh_token_hash] NVARCHAR(64)     NULL;
