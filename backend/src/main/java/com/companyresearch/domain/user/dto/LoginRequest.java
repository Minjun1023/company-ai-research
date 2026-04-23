package com.companyresearch.domain.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class LoginRequest {

    @Email
    @NotBlank
    private String email;

    @NotBlank
    private String password;

    private Boolean rememberMe;

    public LoginRequest() {}

    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public Boolean getRememberMe() { return rememberMe; }
    public void setEmail(String email) { this.email = email; }
    public void setPassword(String password) { this.password = password; }
    public void setRememberMe(Boolean rememberMe) { this.rememberMe = rememberMe; }
}
