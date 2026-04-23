package com.companyresearch.domain.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterRequest {

    @Email
    @NotBlank
    private String email;

    @NotBlank
    @Size(min = 2, max = 20)
    private String name;

    /**
     * 비밀번호 조건: 8자 이상, 영문·숫자·특수문자 각 1개 이상 포함
     */
    @NotBlank
    @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다.")
    @jakarta.validation.constraints.Pattern(
        regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]).{8,}$",
        message = "비밀번호는 영문, 숫자, 특수문자를 각 1개 이상 포함해야 합니다."
    )
    private String password;

    /** 이메일 인증 완료 후 발급된 토큰 */
    @NotBlank(message = "이메일 인증이 필요합니다.")
    private String verifiedToken;

    /** 선택 프로필 필드 */
    private String careerLevel;
    private String desiredJob;
    private String techStack;
    private String desiredIndustry;
    private String resumeText;

    public RegisterRequest() {}

    public String getEmail() { return email; }
    public String getName() { return name; }
    public String getPassword() { return password; }
    public String getVerifiedToken() { return verifiedToken; }
    public String getCareerLevel() { return careerLevel; }
    public String getDesiredJob() { return desiredJob; }
    public String getTechStack() { return techStack; }
    public String getDesiredIndustry() { return desiredIndustry; }
    public String getResumeText() { return resumeText; }

    public void setEmail(String email) { this.email = email; }
    public void setName(String name) { this.name = name; }
    public void setPassword(String password) { this.password = password; }
    public void setVerifiedToken(String verifiedToken) { this.verifiedToken = verifiedToken; }
    public void setCareerLevel(String careerLevel) { this.careerLevel = careerLevel; }
    public void setDesiredJob(String desiredJob) { this.desiredJob = desiredJob; }
    public void setTechStack(String techStack) { this.techStack = techStack; }
    public void setDesiredIndustry(String desiredIndustry) { this.desiredIndustry = desiredIndustry; }
    public void setResumeText(String resumeText) { this.resumeText = resumeText; }
}
