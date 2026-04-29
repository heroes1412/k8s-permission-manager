package server

import (
	"regexp"

	"github.com/go-playground/validator"
)

const validUsernameRegex = "^[a-z0-9]([-a-z0-9]*[a-z0-9])?([@\\.-][a-z0-9]([-a-z0-9]*[a-z0-9])?)*$"
const validK8sNameRegex = "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"

var invalidUsernameError = `username must be lowercase alphanumeric, and can contain "-", ".", or "@" for emails, and must start and end with an alphanumeric character. regex used for validation is ` + validUsernameRegex
var invalidK8sNameError = `name must be lowercase alphanumeric and can contain "-", and must start and end with an alphanumeric character. regex used for validation is ` + validK8sNameRegex

func isValidUsername(username string) (valid bool) {
	re := regexp.MustCompile(validUsernameRegex)
	return re.MatchString(username)
}

func isValidK8sName(name string) (valid bool) {
	re := regexp.MustCompile(validK8sNameRegex)
	return re.MatchString(name)
}

type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
	return cv.validator.Struct(i)

}
