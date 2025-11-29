package models

type UserContact struct {
	Id        uint `json:"id" gorm:"primaryKey;column:id"`
	UserId    uint `json:"userId" gorm:"column:user_id"`
	ContactId uint `json:"contactId" gorm:"column:contact_id"`
}

